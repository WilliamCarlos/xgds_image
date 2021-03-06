#__BEGIN_LICENSE__
# Copyright (c) 2015, United States Government, as represented by the
# Administrator of the National Aeronautics and Space Administration.
# All rights reserved.
#
# The xGDS platform is licensed under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# http://www.apache.org/licenses/LICENSE-2.0.
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.
#__END_LICENSE__
import pytz
import json
import os
import traceback
import time
from datetime import datetime
from dateutil.parser import parse as dateparser
from threading import Thread
from threading import Timer

import requests

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.shortcuts import render
from django.http import HttpResponseRedirect,  HttpResponse, JsonResponse
from django.template import RequestContext
from django.core.urlresolvers import reverse
from django.core.cache import cache
from django.forms.models import model_to_dict

from xgds_image.models import *
from forms import UploadFileForm, ImageSetForm
from xgds_core.views import get_handlebars_templates, addRelay
from xgds_core.util import deletePostKey
from xgds_data.forms import SearchForm, SpecializedForm
from xgds_image.utils import getLatLon, getExifData, getGPSDatetime, createThumbnailFile, getHeading, getAltitude, getExifValue, getHeightWidthFromPIL

from geocamUtil.loader import getModelByName
from geocamUtil.datetimeJsonEncoder import DatetimeJsonEncoder
from geocamUtil import TimeUtil
from geocamUtil.models.UuidField import makeUuid
from geocamUtil.loader import LazyGetModelByName, getClassByName
from geocamUtil.models.managers import ModelCollectionManager

from geocamTrack.utils import getClosestPosition

from PIL import Image
from io import BytesIO
import base64

IMAGE_SET_MODEL = LazyGetModelByName(settings.XGDS_IMAGE_IMAGE_SET_MODEL)
SINGLE_IMAGE_MODEL = LazyGetModelByName(settings.XGDS_IMAGE_SINGLE_IMAGE_MODEL)
CAMERA_MODEL = LazyGetModelByName(settings.XGDS_IMAGE_CAMERA_MODEL)
TRACK_MODEL = LazyGetModelByName(settings.GEOCAM_TRACK_TRACK_MODEL)
POSITION_MODEL = LazyGetModelByName(settings.GEOCAM_TRACK_PAST_POSITION_MODEL)
GEOCAM_TRACK_RESOURCE_MODEL = LazyGetModelByName(settings.GEOCAM_TRACK_RESOURCE_MODEL)

XGDS_IMAGE_TEMPLATE_LIST = list(settings.XGDS_MAP_SERVER_HANDLEBARS_DIRS)
XGDS_IMAGE_TEMPLATE_LIST = XGDS_IMAGE_TEMPLATE_LIST + settings.XGDS_CORE_TEMPLATE_DIRS[settings.XGDS_IMAGE_IMAGE_SET_MODEL]

ARROW_ANNOTATION_MODEL = LazyGetModelByName(settings.XGDS_IMAGE_ARROW_ANNOTATION_MODEL)
ELLIPSE_ANNOTATION_MODEL = LazyGetModelByName(settings.XGDS_IMAGE_ELLIPSE_ANNOTATION_MODEL)
RECTANGLE_ANNOTATION_MODEL = LazyGetModelByName(settings.XGDS_IMAGE_RECTANGLE_ANNOTATION_MODEL)
TEXT_ANNOTATION_MODEL = LazyGetModelByName(settings.XGDS_IMAGE_TEXT_ANNOTATION_MODEL)
ANNOTATION_MANAGER = ModelCollectionManager(AbstractAnnotation,
                                         [ARROW_ANNOTATION_MODEL.get(),
                                          ELLIPSE_ANNOTATION_MODEL.get(),
                                          RECTANGLE_ANNOTATION_MODEL.get(),
                                          TEXT_ANNOTATION_MODEL.get()
                                          ])


@login_required
def getImageImportPage(request):
    # map plus image templates for now
    templates = get_handlebars_templates(XGDS_IMAGE_TEMPLATE_LIST, 'XGDS_IMAGE_TEMPLATE_LIST')
    data = {'imageSetsJson': [],
            'templates': templates,
            'form': UploadFileForm(),
            'imageSetForm': ImageSetForm()
            }
    return render(request,
                  "xgds_image/imageImport.html",
                  data,
                  )


@login_required
def editImage(request, imageSetID):
    imageSet = IMAGE_SET_MODEL.get().objects.get(pk=imageSetID)
    if request.POST:
        form = ImageSetForm(request.POST, instance=imageSet)
        if form.is_valid():
            form.save()
            if form.errors:
                for key, msg in form.errors.items():
                    if key == 'warning':
                        messages.warning(request, msg)
                    elif key == 'error':
                        messages.error(request, msg)
            else:
                messages.success(request, settings.XGDS_IMAGE_IMAGE_SET_MONIKER + ' successfully updated.')
            return HttpResponseRedirect(reverse('search_map_single_object', kwargs={'modelPK':imageSetID,
                                                                                    'modelName':'Photo'}))
        else:
            messages.error(request, 'The form is not valid')
            return render(request,
                          'xgds_image/imageEdit.html',
                          {'form': form})
    elif request.method == "GET":
        form = ImageSetForm(instance=imageSet)
        return render(request,
                      'xgds_image/imageEdit.html',
                      {'form': form,
                       'templates': get_handlebars_templates(list(settings.XGDS_MAP_SERVER_HANDLEBARS_DIRS), 'XGDS_MAP_SERVER_HANDLEBARS_DIRS')})


def updateImageInfo(request):
    """
    Saves update image info entered by the user in the image view.
    """
    if request.method == 'POST':
        imgId = request.POST['id']
        imageSet = IMAGE_SET_MODEL.get().objects.get(pk=imgId)
        form = ImageSetForm(request.POST, instance = imageSet)
        if form.is_valid():
            imageSet = form.save(commit = False)
            changed_position = request.POST['changed_position']
            if int(changed_position) == 1:
                latitude =  form.cleaned_data['latitude']
                longitude =  form.cleaned_data['longitude']
                altitude =  form.cleaned_data['altitude']
                heading =  form.cleaned_data['heading']
                if (latitude or longitude or altitude or heading):
                    if not imageSet.user_position:
                        imageSet.user_position = POSITION_MODEL.get().objects.create(timestamp= imageSet.acquisition_time,
                                                                                     serverTimestamp = imageSet.acquisition_time,
                                                                                     latitude = latitude,
                                                                                     longitude= longitude)
                    else:
                        imageSet.user_position.latitude =  latitude
                        imageSet.user_position.longitude =  longitude
                try:
                    imageSet.user_position.altitude = altitude
                except:
                    pass
                try:
                    imageSet.user_position.heading = heading
                except:
                    pass
                imageSet.user_position.save()
#             imageSet.description = form.cleaned_data['description']
            imageSet.save()
            return HttpResponse(json.dumps([imageSet.toMapDict()], cls=DatetimeJsonEncoder),
                                content_type="application/json"
                                )
        else:
            return HttpResponse(json.dumps({'status': 'error',
                                            'message': "Failed to save."}),
                                content_type='application/json')


def deleteImages(request):
    if request.method == 'POST':
        idList = request.POST.getlist('id[]')
        for imageSetId in idList:
            imageSet = IMAGE_SET_MODEL.get().objects.get(id=imageSetId)
            imageSet.deleted = True
            imageSet.save()
        return HttpResponse(json.dumps({}), content_type = "application/json")
    else:
        return HttpResponse(json.dumps({}), content_type = "application/json")


def createCameraResource(camera):
    ''' Create or retrieve resource instance for this exact camera
    '''
    name = camera.name
    if camera.serial:
        name = name + "_" +  camera.serial
    try:
        found = GEOCAM_TRACK_RESOURCE_MODEL.get().objects.get(name=name)
        return found
    except:
        return GEOCAM_TRACK_RESOURCE_MODEL.get().objects.create(name=name)


def getCameraObject(exif):
    '''
    Given image exif data, either creates a new camera object or returns an
    existing one.
    '''
    cameraName = getExifValue(exif, 'Model')
    if cameraName:
        serial = getExifValue(exif, 'BodySerialNumber')
        cameras = CAMERA_MODEL.get().objects.filter(name=cameraName, serial=serial)
        if cameras.exists():
            return cameras[0]
        else:
            return CAMERA_MODEL.get().objects.create(name = cameraName, serial=serial)
    return None


def buildExifPosition(exif, camera, resource, exifTime, form_tz):
    '''
    Given the image's exif data and a camera object, 
    creates a new position object that contains the lat and lon information.
    '''
    gpsLatLon = getLatLon(exif)
    gpsTimeStamp = getGPSDatetime(exif)
    if gpsTimeStamp:
        gpsTimeStamp = form_tz.localize(gpsTimeStamp)
        gpsTimeStamp = TimeUtil.timeZoneToUtc(gpsTimeStamp)
    else:
        gpsTimeStamp = exifTime

    if gpsTimeStamp and gpsLatLon[0] and gpsLatLon[1]:
        #TODO this requires that the position model has heading and altitude ...
        position = POSITION_MODEL.get().objects.create(serverTimestamp=gpsTimeStamp,
                                                       timestamp= gpsTimeStamp,
                                                       latitude = gpsLatLon[0],
                                                       longitude= gpsLatLon[1],
                                                       heading= getHeading(exif),
                                                       altitude=getAltitude(exif))
        return position

    return None


def getTrackPosition(timestamp, resource):
    '''
    Look up and return the closest tracked position if there is one.
    '''
    return getClosestPosition(timestamp=timestamp, resource=resource)


def getRotationValue(request):
    if request.method == 'POST':
        postDict = request.POST.dict()
        imagePK = int(postDict['imagePK'])
        imageSet = IMAGE_SET_MODEL.get().objects.get(pk = imagePK)
        degrees = imageSet.rotation_degrees
        return HttpResponse(json.dumps({'rotation_degrees': degrees}),
                            content_type='application/json')
    else:
        return HttpResponse(json.dumps({'error': 'request type should be POST'}), content_type='application/json')


def saveRotationValue(request):
    if request.method == 'POST':
        postDict = request.POST.dict()
        degrees = int(postDict['rotation_degrees'])
        imagePK = int(postDict['pk'])
        imageSet = IMAGE_SET_MODEL.get().objects.get(pk = imagePK)
        imageSet.rotation_degrees = degrees
        imageSet.save()
        return HttpResponse(json.dumps({'success': 'true'}),
                            content_type='application/json')
    else:
        return HttpResponse(json.dumps({'error': 'request type should be POST'}), content_type='application/json')

def checkForNewFiles(sdCardIp):
    print "Calling file loader @ %s..." % sdCardIp
    r = requests.get("http://%s/fileUpdate.lua" % sdCardIp)
    print "response:", r.text
    cache.delete("imageAutoloadGlobalTimeMark")
    print ""

def sdWriteEvent(request):
    print "Write event called.  queue event here..."
    print "Full request.meta", request.META
    requestingIp = request.META["HTTP_X_REAL_IP"]
    cache.set('imageAutoloadGlobalTimeMark', time.time())
    fCheck = Timer(1.5, checkForNewFiles, (requestingIp,) )
    fCheck.start()
    return HttpResponse("OK", content_type='text/plain')

def saveImage(request):
    """
    Image drag and drop, saves the files and to the database.
    """
    if request.method == 'POST':
        timeMark = time.time()
        form = UploadFileForm(request.POST, request.FILES)
        if form.is_valid():
            # create and save a single image obj
            uploadedFile = request.FILES['file']
            newSingleImage = SINGLE_IMAGE_MODEL.get()(file = uploadedFile)

            form_tz = form.getTimezone()
            resource = form.getResource()
            exifData = getExifData(newSingleImage)

            # save image dimensions and file size
            try:
                newSingleImage.width = int(getExifValue(exifData, 'ExifImageWidth'))
                newSingleImage.height = int(getExifValue(exifData, 'ExifImageHeight'))
            except:
                pass

            newSingleImage.fileSizeBytes = uploadedFile.size

            # get exif time
            exifTime  = None
            exifTimeString = getExifValue(exifData, 'DateTimeOriginal')
            if not exifTimeString:
                exifTimeString = getExifValue(exifData, 'DateTime')

            if exifTimeString:
                exifTime = datetime.strptime(str(exifTimeString), '%Y:%m:%d %H:%M:%S')
                if (form_tz != pytz.utc) and exifTime:
                    localized_time = form_tz.localize(exifTime)
                    exifTime = TimeUtil.timeZoneToUtc(localized_time)
                else:
                    exifTime = exifTime.replace(tzinfo=pytz.utc)
            else:
                # read the time from the last modified time that we pushed in from imageUpload.js
                if 'HTTP_LASTMOD' in request.META:
                    modtimesString = request.META['HTTP_LASTMOD']
                    if modtimesString:
                        modtime = None
                        theImages = modtimesString.split(',')
                        for i in theImages:
                            k,v = i.split('||')
                            if k == str(uploadedFile.name):
                                modtime = datetime.fromtimestamp(int(v)/1000)
                                break
                        if modtime:
                            localized_time = form_tz.localize(modtime)
                            exifTime = TimeUtil.timeZoneToUtc(localized_time)
            if not exifTime:
                exifTime = datetime.now(pytz.utc)
            # create a new image set instance

            author = None
            if request.user.is_authenticated():
                author = request.user  # set user as image author
            elif 'username' in request.POST:
                try:
                    username = str(request.POST['username'])
                    author = User.objects.get(username=username)
                except:
                    author = User.objects.get(username='camera')

            if 'object_id' in request.POST:
                newImageSet = IMAGE_SET_MODEL.get()(pk=int(request.POST['object_id']))
            else:
                newImageSet = IMAGE_SET_MODEL.get()()

            newImageSet.acquisition_time = exifTime
            newImageSet.acquisition_timezone = form.getTimezoneName()
            fileName = uploadedFile.name
            newImageSet.name = fileName
            newImageSet.camera = getCameraObject(exifData)

            newImageSet.track_position = getTrackPosition(exifTime, resource)
            newImageSet.exif_position = buildExifPosition(exifData, newImageSet.camera, resource, exifTime, form_tz)

            newImageSet.author = author
            newImageSet.resource = resource
            newImageSet.finish_initialization(request)

            nowTime = time.time()
            uploadAndSaveTime = nowTime - timeMark
            newImageSet.uploadAndSaveTime = uploadAndSaveTime
            overallStartTime = cache.get("imageAutoloadGlobalTimeMark", None)
            if overallStartTime:
                totalTimeSinceNotify = nowTime - float(overallStartTime)
                newImageSet.totalTimeSinceNotify = totalTimeSinceNotify
            newImageSet.save()

            # link the "image set" to "image".
            newSingleImage.imageSet = newImageSet
            newSingleImage.save()

            # relay if needed
            if 'relay' in request.POST:
                # create the record for the datum
                # fire a message for new data
                deletePostKey(request.POST, 'relay')
                addRelay(newImageSet, request.FILES, json.dumps(request.POST), reverse('xgds_save_image'))
            # create a thumbnail
            thumbnailStream = createThumbnailFile(newSingleImage.file)
            SINGLE_IMAGE_MODEL.get().objects.create(file = thumbnailStream,
                                                    raw = False,
                                                    thumbnail = True,
                                                    imageSet = newImageSet)

            # create deep zoom tiles for viewing in openseadragon.
            if (newImageSet.create_deepzoom):
                deepzoomTilingThread = Thread(target=newImageSet.create_deepzoom_image)
                deepzoomTilingThread.start()
#                newImageSet.create_deepzoom_image()

            imageSetDict = newImageSet.toMapDict()
            # pass the image set to the client as json.
            return HttpResponse(json.dumps({'success': 'true',
                                            'json': imageSetDict}, cls=DatetimeJsonEncoder),
                                content_type='application/json')
        else:
            return HttpResponse(json.dumps({'error': 'Imported image is not valid','details':form.errors}), content_type='application/json')


def getTileState(request, imageSetPK):
    try:
        image = IMAGE_SET_MODEL.get().objects.get(pk=imageSetPK)
        return HttpResponse(json.dumps({'pk': imageSetPK,
                                        'create_deepzoom': image.create_deepzoom,
                                        'deepzoom_file_url': image.deepzoom_file_url}),
                                        content_type='application/json')
    except Exception, e:
        return HttpResponse(json.dumps({'pk': imageSetPK,
                                        'error': str(e)}),
                                        content_type='application/json',
                                            status=404)


def saveAnnotations(request):
    if request.method == 'POST':
        temp = request.POST.get('mapAnnotations', None)
        mapAnnotations = json.loads(temp)

        for annotationJSON in mapAnnotations["objects"]:
            # print "annotation type: {0}".format(annotationJSON["type"])
            # print annotationJSON['type']
            if annotationJSON["type"]=="rect":
                annotationModel =RECTANGLE_ANNOTATION_MODEL.get()()
                annotationModel.width = annotationJSON["width"]
                annotationModel.height = annotationJSON["height"]

            elif annotationJSON["type"]=="ellipse":
                annotationModel = ELLIPSE_ANNOTATION_MODEL.get()()
                annotationModel.radiusX = annotationJSON["rx"]
                annotationModel.radiusY = annotationJSON["ry"]

            elif annotationJSON["type"]=="arrow":
                annotationModel = ARROW_ANNOTATION_MODEL.get()()
                annotationModel.points = json.dumps(annotationJSON["points"])

            elif annotationJSON["type"]=="text":
                annotationModel = TEXT_ANNOTATION_MODEL.get()()
                annotationModel.width = annotationJSON["width"]
                annotationModel.height = annotationJSON["height"]
                print "annotationJSON[text]"
                print annotationJSON["text"]
                annotationModel.content = annotationJSON["text"] #not sure if this is where text content is stored

            else:
                print "That shape doesn't exist"
                #your shape doesn't exist
                #throw some kind of error

            #add common variables
            annotationModel.left = annotationJSON["left"]
            annotationModel.top = annotationJSON["top"]
            annotationModel.strokeWidth = annotationJSON["strokeWidth"]
            annotationModel.strokeColor = AnnotationColor.objects.get(pk=1)
            annotationModel.originX = annotationJSON["originX"]
            annotationModel.originY = annotationJSON["originY"]
            annotationModel.fill = AnnotationColor.objects.get(pk=1)
            annotationModel.angle = annotationJSON["angle"]
            annotationModel.scaleX = annotationJson["scaleX"]
            annotationModel.scaleY = annotationJson["scaleY"]
            annotationModel.size = newAnnotation["size"]

            annotationModel.author = request.user
            annotationModel.image_id = request.POST.get('image_pk')
            annotationModel.save()
        return HttpResponse(json.dumps(mapAnnotations), #useless HttpResponse
                            content_type='application/json')

    else:
        return HttpResponse(json.dumps({'error': 'request type should be POST'}), content_type='application/json')


def alterAnnotation(request):
    if request.method=='POST':
        temp = request.POST.get('annotation', None)
        newAnnotation = json.loads(temp)
        try:
            image = request.POST.get('image_pk')
            pk = newAnnotation["pk"]
            queryResult = ANNOTATION_MANAGER.filter(image__pk=image, pk=pk)
            annotationModel = queryResult[0]
        except Exception as e:
            print "406 exception threw as {0}".format(e)
            return HttpResponse(json.dumps({'error': 'Could not load annotation'}), content_type='application/json', status=406)

        if newAnnotation["type"] == "rect":
            annotationModel.width = newAnnotation["width"]
            annotationModel.height = newAnnotation["height"]

        elif newAnnotation["type"] == "ellipse":
            annotationModel.radiusX = newAnnotation["rx"]
            annotationModel.radiusY = newAnnotation["ry"]

        elif newAnnotation["type"] == "arrow":
            annotationModel.points = json.dumps(newAnnotation["points"])
        else: #it's text
            annotationModel.width = newAnnotation["width"]
            annotationModel.height = newAnnotation["height"]
            print newAnnotation["text"]
            annotationModel.content = newAnnotation["text"]

        # add common variables
        annotationModel.left = newAnnotation["left"]
        annotationModel.top = newAnnotation["top"]
        annotationModel.strokeColor = AnnotationColor.objects.get(pk=newAnnotation["stroke"])
        annotationModel.fill = AnnotationColor.objects.get(pk=newAnnotation["fill"])
        annotationModel.angle = newAnnotation["angle"]
        annotationModel.scaleX = newAnnotation["scaleX"]
        annotationModel.scaleY = newAnnotation["scaleY"]
        annotationModel.size = newAnnotation["size"]

        annotationModel.save()
        return HttpResponse(json.dumps(newAnnotation),  # useless HttpResponse
                        content_type='application/json')
    else:
        return HttpResponse(json.dumps({'error': 'request type should be POST'}), content_type='application/json', status=406)


def getAnnotationsJson(request, imagePK):
    queryResult = ANNOTATION_MANAGER.filter(image__pk=imagePK)
    result = []
    for a in queryResult:
        result.append(a.toJson())
    return HttpResponse(json.dumps(result), content_type='application/json')


def getAnnotationColorsJson(request):
    colors = AnnotationColor.objects.all()
    result = []
    for color in colors:
        result.append(model_to_dict(color))
    return HttpResponse(json.dumps(result), content_type='application/json');


def deleteAnnotation(request):
    try:
        pk = request.POST.get('pk', None)
        queryResult = ANNOTATION_MANAGER.filter(pk=pk)
    except:
        return HttpResponse(json.dumps({'error': 'Could not load annotation'}), content_type='application/json',
                            status=406)
    annotationModel = queryResult[0]
    annotationModel.delete()
    return HttpResponse('')


def addAnnotation(request):
    if request.method == 'POST':
        temp = request.POST.get('annotation', None)
        newAnnotation = json.loads(temp)
        if newAnnotation["type"] == "rect":
            annotationModel = RECTANGLE_ANNOTATION_MODEL.get()()
            annotationModel.width = newAnnotation["width"]
            annotationModel.height = newAnnotation["height"]

        elif newAnnotation["type"] == "ellipse":
            annotationModel = ELLIPSE_ANNOTATION_MODEL.get()()
            annotationModel.radiusX = newAnnotation["rx"]
            annotationModel.radiusY = newAnnotation["ry"]

        elif newAnnotation["type"] == "arrow":
            annotationModel = ARROW_ANNOTATION_MODEL.get()()
            annotationModel.points = json.dumps(newAnnotation["points"])
        else:  # it's text
            annotationModel = TEXT_ANNOTATION_MODEL.get()()
            annotationModel.width = newAnnotation["width"]
            annotationModel.height = newAnnotation["height"]
            annotationModel.content = newAnnotation["text"]

        # add common variables
        annotationModel.left = newAnnotation["left"]
        annotationModel.top = newAnnotation["top"]
        annotationModel.strokeWidth = newAnnotation["strokeWidth"]
        annotationModel.strokeColor = AnnotationColor.objects.get(pk=newAnnotation["stroke"])
        annotationModel.originX = newAnnotation["originX"]
        annotationModel.originY = newAnnotation["originY"]
        annotationModel.fill = AnnotationColor.objects.get(pk=newAnnotation["fill"])
        annotationModel.angle = newAnnotation["angle"]
        annotationModel.scaleX = newAnnotation["scaleX"]
        annotationModel.scaleY = newAnnotation["scaleY"]
        annotationModel.size = newAnnotation["size"]

        annotationModel.author = request.user
        annotationModel.image_id = int(request.POST.get('image_pk'))
        print 'save annotation image id from request.POST ' + request.POST.get('image_pk')
        print annotationModel.image_id
        annotationModel.save()

        return HttpResponse(json.dumps(annotationModel.toJson()),
                            content_type='application/json')
    else:
        return HttpResponse(json.dumps({'error': 'request type should be POST'}), content_type='application/json',
                            status=406)
# Pastes the annotation canvas image onto the OSD canvas image to get a new "downloadable" image of annotations + OSD
# canvas combined.
def mergeImages(request):
    if request.method == 'POST':
        # Get exif data from original image (which we want to preserve in the returned image)
        imagePK = request.POST.get('imagePK', None)
        imageSet = IMAGE_SET_MODEL.get().objects.get(pk=imagePK)
        image = imageSet.getRawImage()
        exifData = getExifData(image)

        # load images
        temp1 = request.POST.get('image1', None)
        temp2 = request.POST.get('image2', None)

        temp1 = temp1[22:]  # remove data:image/png;base64, (22 characters long)
        temp2 = temp2[22:]  # this is pure base64 bitstream

        # decode base 64 bitstream for PIL
        background = Image.open(BytesIO(base64.b64decode(temp1)))
        foreground = Image.open(BytesIO(base64.b64decode(temp2)))

        # PIL paste foreground on background
        background.paste(foreground, (0, 0), foreground)

        # Save background into Byte Array/Stream
        imgByteArr = BytesIO()
        background.save(imgByteArr, format='JPEG', exif=str(exifData))
        imgByteArr = imgByteArr.getvalue()

        # Build response
        response = HttpResponse(content_type='image/jpg')
        background.save(response, "JPEG")
        response['Content-Disposition'] = 'attachment; filename="%s.jpg"' % os.path.splitext(imageSet.name)[0]
        return response
    else:
        return HttpResponse(json.dumps({'error': 'request type should be POST'}), content_type='application/json',
                            status=406)



