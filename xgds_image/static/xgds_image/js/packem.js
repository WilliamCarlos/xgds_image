function initializePackery() {
	//update  sizing
	var $container = $('#container');
	$container.packery({
		itemSelector: '.item',
		gutter: 10
	});

	makeResizable($container);
	bindLockItemBtnCallback($container);

}

function makeResizable($container) {
	// get item elements, jQuery-ify them
	var $itemElems = $( $container.packery('getItemElements') );
	makeChildrenResizable($container, $itemElems);
}

function makeChildrenResizable($container, $itemElems){

		var $lockAspects = $(".lockAspect");
		// make item elements draggable
		$lockAspects.draggable().resizable({
			aspectRatio: true
		});

		var $freeAspects = $(".freeAspect");
		if ($freeAspects !== null){
			$freeAspects.draggable().resizable();
		}
		
		// bind Draggable events to Packery
		$container.packery( 'bindUIDraggableEvents', $itemElems );

		// handle resizing
		var resizeTimeout;
		$itemElems.on( 'resize', function( event, ui ) {
			// debounce
			if ( resizeTimeout ) {
				clearTimeout( resizeTimeout );
			}

			resizeTimeout = setTimeout( function() {
				$container.packery( 'fit', ui.element[0] );
			}, 100 );
		});
}

/**
 * Locks/unlocks the packery template when user clicks on the key icon.
 */
function bindLockItemBtnCallback($container) {
	$container.find(".icon-key").bind("click", function() {
		var key = event.target;
		if (stringContains(key.parentElement.className, "item")) {
			$stamp = key.parentElement;
		} else {
			$stamp = key.parentElement.parentElement;
		}
		
		var isStamped = $stamp.getAttribute('data-isStamped');
		if ( isStamped == "true") {
			$container.packery( 'unstamp', $stamp );
			$stamp.setAttribute('data-isStamped', 'false');
			this.style.color = "silver";
		} else {
			$container.packery( 'stamp', $stamp );
			$stamp.setAttribute('data-isStamped', 'true');
			this.style.color = "grey";
		}
		$container.packery();
	});
}
