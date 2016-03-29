//__BEGIN_LICENSE__
// Copyright (c) 2015, United States Government, as represented by the
// Administrator of the National Aeronautics and Space Administration.
// All rights reserved.
//
// The xGDS platform is licensed under the Apache License, Version 2.0
// (the "License"); you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0.
//
// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
//__END_LICENSE__

var $container = $('#container'); 
var inputNum = 0;

function stringContains(string, substring) {
	// checks that string contains substring
	return string.indexOf(substring) > -1;
}

/**
 *  Selectable row in image table  
 */
function handleImageSelection(theRow){
    var template = $('#image_view');
    var newindex = $(theRow).index();
    if (template.length == 0){
	// no view, construct it
	constructImageView(imageSetsArray[newindex]);
    } else {
	updateImageView(template, newindex, null, false, false);
    }
}

function setupTableSelection() {
    connectSelectionCallback($("#image_table"), handleImageSelection, true);
}

/* Add a click handler for the delete row */
$('#delete_images').click( function() {
    var selectedRows = getSelectedRows( theDataTable );
    // get a list containing just the id's of selected images
    var selectedImageIdsList = jQuery.map(selectedRows, function(element) { return jQuery(element).attr('id'); });
    var selectedImageIdsJson = {"id": selectedImageIdsList};
	//delete selected images from db
    var url = deleteImagesUrl;
    $.ajax({
		url: url,
		type: "POST",
		data: selectedImageIdsJson, // serializes the form's elements.
		success: function(data) {
			console.log("images successfully deleted");
		},
		error: function(request, status, error) {
			console.log("error! ", error);
		}
	})
	
	// delete selected rows from datatable.
    for (var i = 0; i < selectedRows.length; i++) { 
        theDataTable.fnDeleteRow(selectedRows[i]);
    }
    // re-render the map icons with only the non-deleted images.
    showOnMap(theDataTable.fnGetData());
} );


/*
 * Event binders
 */
/**
 * Hook up edit info and add note buttons
 */
function activateButtons(template) {
	template.find("#edit_info_button").click(function(event) {
	    event.preventDefault();
	    template.find("#image_overview").hide();
	    template.find("#more_info_view").show();
	});
	template.find("#cancel_edit").click(function(event) {
	    event.preventDefault();
	    template.find("#more_info_view").hide();
	    template.find("#image_overview").show();
	});
	template.find("#add_note_button").click(function(event) {
	    event.preventDefault();
	    template.find("#notes_input").show();
	});
}


function setChangedPosition(value, template) {
	$(template).find('#id_changed_position').attr('value', value);
}


/**
 * Set the changed_position to true if the user edits any of the position fields.
 * @param template
 */
function hookEditingPosition(template) {
	$(template).find("#id_latitude").change(function() {setChangedPosition(1, template)});
	$(template).find("#id_longitude").change(function() {setChangedPosition(1, template)});
	$(template).find("#id_altitude").change(function() {setChangedPosition(1, template)});
	$(template).find("#id_heading").change(function() {setChangedPosition(1, template)});
}

/**
 * Saves image info to the db when user updates it and submits.
 */
function onUpdateImageInfo(template) {
	$(template).find("#updateInfoSubmit").on('click', function(event) {
		event.preventDefault(); 	// avoid to execute the actual submit of the form.
		var url = updateImageUrl; // the script where you handle the form input.
		var postData = $("#more-info-form").serialize();
		$.ajax({
			url: url,
			type: "POST",
			data: postData, // serializes the form's elements.
			success: function(data)
			{
			    setSaveStatusMessage($('#message'), 'Saved','');
			    updateImageView(template, undefined, data[0], true, true);
			    template.find("#more_info_view").hide();
			    template.find("#image_overview").show();
			},
			error: function(request, status, error) {
			    setSaveStatusMessage($('#message'), status, error);
			}
		});
		return false; 
	});
}


/* 
 * Image next and previous button support
 */
/**
 * Helper that finds index in imageSetsArray
 * of the currently displayed image in the imageView.
 */
function getCurrentImageAndIndex(template) {
	// get the img's name.
	var currentImgUrl = template.find(".display-image").attr('src');
	var currentImgIndex = null;
	// find the index of the current img
	for (var i = 0; i < imageSetsArray.length; i++) {
		if (imageSetsArray[i]['raw_image_url'] == currentImgUrl) {
			currentImgIndex = i;
			break;
		}
	}
	return currentImgIndex;
}

/**
 * Update the image view with newly selected image.
 */
function updateImageView(template, index, imageJson, keepingImage, keepingNotes) {
    if (imageJson == null){
	if (index != null) {
	    imageJson = imageSetsArray[index];
	} else {
	    return;
	}
    }
    
    if (!keepingNotes){
	var tbl = template.find('table#notes_list');
	if ( $.fn.DataTable.isDataTable( tbl) ) {
	    var dt = $(tbl).dataTable()
	    dt.fnClearTable();
	}
	initializeNotesReference(template, imageJson['app_label'], imageJson['model_type'], imageJson['id'], imageJson['acquisition_time'], imageJson['acquisition_timezone']);
	getNotesForObject(imageJson['app_label'], imageJson['model_type'], imageJson['id'], 'notes_content', dt);
    }
    
    if (!keepingImage){
	var mainImg = template.find(".display-image");
	var placeholderImg = template.find(".loading-image");
	template.find("#loading-image-msg").show();
	template.find(".image-name strong").hide();
	mainImg.hide();
	placeholderImg.show();
	
	// load the next image
	mainImg.attr('src', imageJson['raw_image_url']);
        // show next image name, hide placeholder
        mainImg.on('load', function() { // when main img is done loading
        	// load next img's name
        	template.find(".image-name strong").text(imageJson['name']);
        	// show next img name
        	template.find(".image-name strong").show();
        	// hide loading msg
        	template.find("#loading-image-msg").hide();
        	// show main img and hide place holder
        	mainImg.show();
        	placeholderImg.hide();
        });
    } else {
	template.find(".image-name strong").text(imageJson['name']);
    }

    // update values
    template.find('a#new-window-target').attr('href',imageJson['view_url']);
    template.find('#id_id').attr('value', imageJson['id']);
    template.find('#overview_description').text(imageJson['description']);
    template.find('textarea[name="description"]').attr('value', imageJson['description']);
    template.find('input[name="name"]').attr('value', imageJson['name']);
    template.find('input[name="latitude"]').attr('value', imageJson['lat']);
    template.find('input[name="longitude"]').attr('value', imageJson['lon']);
    template.find('input[name="altitude"]').attr('value', imageJson['altitude']);
    template.find('input[name="heading"]').attr('value', imageJson['heading']);
    template.find('#id_changed_position').attr('value', 0);
    
    // update table selection
    ensureSelectedRow(theDataTable, index + 1);
}

function hideImageNextPrev() {
   $('.prev-button').hide();
   $('.next-button').hide();
}

function onImageNextOrPrev(template) {
	template.find('.next-button').click(function(event) {
		// set the img src
		var index = getCurrentImageAndIndex(template);
		if (index != null) {
		    index = index + 1;
		    if (index == imageSetsArray.length){
			index = 0;
		    }
		    clearTableSelection(theDataTable);
		    updateImageView(template, index, null, false, false);
		}
	});
	template.find(".prev-button").click(function(event) {
		var index = getCurrentImageAndIndex(template);
		if (index != null) {
		    index = index - 1;
		    if (index < 0){
			index = imageSetsArray.length - 1;
		    }
		    clearTableSelection(theDataTable);
		    updateImageView(template, index, null, false, false);
		}
	});
}

/*
 * Construct the image view item
 */
function constructImageView(json, viewPage) {
	viewPage = typeof viewPage !== 'undefined' ? viewPage : false;
	var rawTemplate = $('#template-image-view').html();
	var compiledTemplate = Handlebars.compile(rawTemplate);
	
	// append additional fields to json object to pass to handlebar
	json.imageName = json['name'];
	json.imagePath = json['raw_image_url'];
	json.imageUrl = json['view_url'];
	json.STATIC_URL = STATIC_URL;
	json.acquisition_time = getLocalTimeString(json['acquisition_time'], json['acquisition_timezone']);
	
	var newDiv = compiledTemplate(json);
	var imageViewTemplate = $(newDiv);
	
	// hide the img loading msg
	imageViewTemplate.find("#loading-image-msg").hide();
	
	// callbacks
	hookEditingPosition(imageViewTemplate);
	onUpdateImageInfo(imageViewTemplate);
	activateButtons(imageViewTemplate);
	
	if (!viewPage){
	    onDelete(imageViewTemplate);
	    onImageNextOrPrev(imageViewTemplate);
	}
	
	// append the div to the container and packery.
	var newEl;
	if (!viewPage){
	    newEl = $container.append(imageViewTemplate);
	} else {
	    newEl = $container.prepend(imageViewTemplate);
	}
	// pin the packery elem.
	if (!viewPage){
	    newEl.find(".pinDiv").click(function(event){clickPinFunction(event)});
	    $container.packery( 'appended', imageViewTemplate);
	    makeChildrenResizable($container, imageViewTemplate);
	}
	// set the loading image to be displayed when main img is loading
	imageViewTemplate.find(".display-image").load(function() {
		// set dimensions of loading image
		var width = imageViewTemplate.find(".display-image").width();
		var height = imageViewTemplate.find(".display-image").height();
		imageViewTemplate.find(".loading-image").width(width);	
		imageViewTemplate.find(".loading-image").height(height);
		imageViewTemplate.find(".loading-image").hide();
	});
	setChangedPosition(0, imageViewTemplate);
	
	//add the notes if it does not exist
	var notes_content_div = imageViewTemplate.find("#notes_content");
	var notes_table = undefined;
	if ($(notes_content_div).is(':empty')){
	    // the first time we want to fill it in
	    notes_table = $.find("table#notes_list");
	    var notes_input_div = $.find("#notes_input");

	    var new_input_div = $(notes_input_div).hide();
	    $(notes_content_div).append(new_input_div);
	    
	    var new_table_div = $(notes_table);
	    $(notes_content_div).append(new_table_div);
	    $(new_table_div).removeAttr('hidden');
	    $(new_table_div).show();
	    
	    var taginput = $(new_input_div).find('.taginput');
	    initializeInput(taginput);
	    hookNoteSubmit();
	    
	} else {
	    notes_table = imageViewTemplate.find("table#notes_list");
	}
	
	initializeNotesReference(imageViewTemplate, json['app_label'], json['model_type'], json['id'], json['creation_time']);
	getNotesForObject(json['app_label'], json['model_type'], json['id'], 'notes_content', $(notes_table));
}

function setSaveStatusMessage(handler, status, msg){
	if (status == 'success') {
		handler.attr('class', 'success-message');
	} else {
		handler.attr('class', 'error-message');
	}
	handler.html(msg);
	setTimeout(function() { // messages fades out.
		handler.fadeOut().empty();
	}, 5000);
}

