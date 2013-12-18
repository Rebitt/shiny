/*jshint browser:true, jquery:true, strict:false, curly:false, indent:2*/

(function() {
  // Given a DOM node and a column (count of characters), walk recursively
  // through the node's siblings counting characters until the given number
  // of characters have been found. 
  // 
  // If the given count is bigger than the number of characters contained by
  // the node and its siblings, returns a null node and the number of 
  // characters found.
  function findTextColPoint(node, col) {
    var cols = 0;
    if (node.nodeType === 3) {
      if (node.nodeValue.length >= col) {
        return { element: node, offset: col };
      } else {
        cols += node.nodeValue.length;
      }
    } else if (node.nodeType === 1 && node.firstChild) {
      var ret = findTextColPoint(node.firstChild, col);
      if (ret.element !== null) {
        return ret;
      } else {
        cols += ret.offset;
      }
    }
    if (node.nextSibling)
      return findTextColPoint(node.nextSibling, col - cols);
    else
      return { element: null, offset: cols };
  }

  // Returns an object indicating the element containing the given line and
  // column of text, and the offset into that element where the text was found. 
  //
  // If the given line and column are not found, returns a null element and
  // the number of lines found.
  function findTextPoint(el, line, col) {
    var newlines = 0;
    for (var childId = 0; childId < el.childNodes.length; childId++) {
      var child = el.childNodes[childId];
      // If this is a text node, count the number of newlines it contains.
      if (child.nodeType === 3) {  // TEXT_NODE
        var newlinere = /\n/g;
        var match;
        while ((match = newlinere.exec(child.nodeValue)) !== null) {
          newlines++;
          // Found the desired line, now find the column.
          if (newlines === line) {
            return findTextColPoint(child, match.index + col + 1);
          }
        }
      }
      // If this is not a text node, descend recursively to see how many 
      // lines it contains.
      else if (child.nodeType === 1) { // ELEMENT_NODE
        var ret = findTextPoint(child, line - newlines, col);
        if (ret.element !== null)
          return ret; 
        else 
          newlines += ret.offset;
      }
    }
    return { element: null, offset: newlines };
  }

  // Draw a highlight effect for the given source ref. srcref is assumed to be
  // an integer array of length 6, following the standard R format for source
  // refs.
  function highlightSrcref (srcref) {
    // Check to see if we already have a marker for this source ref
    var el = document.getElementById("srcref_" + srcref);
    if (!el) {
      // We don't have a marker, create one 
      el = document.createElement("span");
      el.id = "srcref_" + srcref;
      var ref = srcref;
      var code = document.getElementById("server-r-code"); 
      var start = findTextPoint(code, ref[0], ref[4]); 
      var end = findTextPoint(code, ref[2], ref[5]); 
      var range = document.createRange();
      // If the text points are inside different <SPAN>s, we may not be able to
      // surround them without breaking apart the elements to keep the DOM tree
      // intact. Just move the selection points to encompass the contents of
      // the SPANs. 
      if (start.element.parentNode.nodeName === "SPAN" &&
          start.element !== end.element) {
        range.setStartBefore(start.element.parentNode);
      } else {
        range.setStart(start.element, start.offset);
      }
      if (end.element.parentNode.nodeName === "SPAN" && 
          start.element !== end.element) {
        range.setEndAfter(end.element.parentNode);
      } else {
        range.setEnd(end.element, end.offset);
      }
      range.surroundContents(el);
    }
    // End any previous highlight before starting this one
    jQuery(el)
      .stop(true, true)
      .effect("highlight", null, 1600);
  }

  // If this is the main Shiny window, wire up our custom message handler.
  if (window.Shiny) {
    Shiny.addCustomMessageHandler('reactlog', function(message) {
      if (message.srcref) {
        highlightSrcref(message.srcref);
      }
    });
  }

  var isCodeAbove = false;
  var setCodePosition = function(above) {
    // set the source and targets for the tab move
    var newHostElement = above ? 
      document.getElementById("showcase-sxs-code") :
      document.getElementById("showcase-code-inline");
    var currentHostElement = above ? 
      document.getElementById("showcase-code-inline") :
      document.getElementById("showcase-sxs-code");

    // change the text on the toggle button to reflect the new state
    document.getElementById("showcase-code-position-toggle").innerHTML = above ?
      '<i class="fa fa-level-down"></i> show below' :
      '<i class="fa fa-level-up"></i> show with app';
    

    $(currentHostElement).fadeOut(400, function() {
      var tabs = document.getElementById("showcase-code-tabs");
      currentHostElement.removeChild(tabs);
      newHostElement.appendChild(tabs);
      $(newHostElement).fadeIn();
      if (!above) {
        // remove the applied width and zoom on the app container, and 
        // scroll smoothly down to the code's new home
        document.getElementById("showcase-app-container").removeAttribute("style");
        $(document.body).animate({ scrollTop: $(newHostElement).offset().top });
      }
      // if there's a readme, toggle it between full width and alongside
      var readme = document.getElementById("readme-md");
      if (readme !== null) {
        readme.className = above ? 
          "span10 offset1" :
          "span3";
      }
    });
    if (above) {
      $(document.body).animate({ scrollTop: 0 });
    }
    $(newHostElement).hide();
    isCodeAbove = above;
    setAppCodeSxsWidths(above);
    $(window).trigger("resize");
  }

  var setAppCodeSxsWidths = function(animate) {
    var appTargetWidth = appWidth = 960;
    var zoom = 1.0;
    var totalWidth = document.getElementById("showcase-app-code").offsetWidth;
    if (totalWidth / 2 > appTargetWidth) {
      // If the app can use only half the available space and still meet its
      // target, take half the available space.
      appWidth = totalWidth / 2;
    } else if (totalWidth * 0.66 > appTargetWidth)  {
      // If the app can meet its target by taking up more space (up to 66%
      // of its container), take up more space.
      appWidth = 960;
    } else {
      // The space is too narrow for the app and code to live side-by-side
      // in a friendly way. Keep the app at 2/3 of the space but scale it.
      appWidth = totalWidth * 0.66;
      zoom = appWidth/appTargetWidth;
    }
    var app = document.getElementById("showcase-app-container");
    $(app).animate({
        width: appWidth + "px",
        zoom: zoom
      }, animate ? 400 : 0);
    document.getElementById("showcase-code-content").style.height = 
      app.firstElementChild.offsetHeight + "px";
  }

  var toggleCodePosition = function() {
    setCodePosition(!isCodeAbove);
  }

  $(window).resize(function() {
    if (isCodeAbove) {
      setAppCodeSxsWidths(false);
    }
  });

  window.toggleCodePosition = toggleCodePosition;
})();

