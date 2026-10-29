const MODE_CLOSED = 1;
const MODE_VERTICAL = 2;
const MODE_THEATRE = 3;


const PLAYER_SELECTOR = ".persistent-player";
const MIN_CHAT_HEIGHT = 100; // px - keep at least this much chat visible

const playerStyle = document.createElement('style');
playerStyle.type = 'text/css';
const chatStyle = document.createElement('style');
chatStyle.type = 'text/css';
document.getElementsByTagName('head')[0].appendChild(playerStyle)
document.getElementsByTagName('head')[0].appendChild(chatStyle);


const UNFILLED_ICON =
  "M2 15V5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2zm2 0V5h7v10H4zm9 0h3V5h-3v10z";
const FILLED_ICON =
  "M4 3a2 2 0 00-2 2v10a2 2 0 002 2h7V3H4zM16 3h-3v14h3a2 2 0 002-2V5a2 2 0 00-2-2z";

// Remembers the player's height-to-width ratio (set whenever the user
// manually drags the chat divider) so that when the *window* is resized
// we can keep the player at the same proportions instead of it
// pillarboxing (black bars) while the chat panel silently keeps its old
// pixel height.
let playerAspectRatio = null;

// Twitch re-renders the player and chat (channel switch, resize), stripping
// our vt-* classes while #root keeps "vertical-enabled", which hides the
// player. Remember the mode so reapplyMode() can restore it.
let currentMode = MODE_CLOSED;

function isOpen() {
  return $(".vt-chat").length > 0;
}

function isTheatre() {
  return $(".vertical-theatre-mode").length > 0;
}

function isVertical() {
  return isOpen() && !isTheatre();
}

function isHorizontalTheatre() {
  return $(".root-scrollable").length == 0;
}

function onResize(preserveRatio) {
  if (!isOpen()) {
    return;
  }
  const chatParent = $(".chat-shell").parent().parent();
  const totalHeight = $(isVertical() ? "main" : "#root" ).height();
  const totalWidth = $(isVertical() ? "main" : "#root").width();
  const yAdjustment = isVertical() ? 0 : -50;

  let playerHeight;

  if (preserveRatio && playerAspectRatio) {
    // Triggered by a window/container resize (not a manual chat drag):
    // recompute the player's height from the *new* width using the last
    // known-good ratio, instead of trusting the chat panel's stale
    // pixel height. This is what keeps the player from pillarboxing.
    playerHeight = Math.min(
      totalWidth * playerAspectRatio,
      totalHeight - MIN_CHAT_HEIGHT
    );
    chatParent.height(totalHeight - playerHeight);
  } else {
    // Triggered by a manual chat-panel drag (or initial seeding): trust
    // whatever height the chat panel currently has, and remember the
    // resulting ratio for next time the window itself is resized.
    const chatHeight = chatParent.height();
    playerHeight = totalHeight - chatHeight;
    playerAspectRatio = playerHeight / totalWidth;
  }

  playerStyle.innerHTML = `.vt-player { 
    top: 0 !important;
    left: 0 !important;
    height: ${playerHeight}px !important;
    width: 100% !important;
  }`;

  chatStyle.innerHTML = `.vt-chat {
    transform: translateX(${-totalWidth}px) translateY(${playerHeight+yAdjustment}px) !important;
    top: 0 !important;
    transition: none !important;
    width: ${totalWidth}px !important; 
  }`;
}

function change(mode) {
  const player = $(PLAYER_SELECTOR);
  const chatParent = $(".chat-shell").parent().parent();
  const totalHeight = $(mode == MODE_THEATRE ? "#root" : "main").height();
  const totalWidth = $(mode == MODE_THEATRE ? "#root" : "main").width();
  const root = $("#root");

  // Twitch adds a -50 sometimes when we revert back to normal.
  player.css('left', 0);

  const isFirstChange = !isOpen();

  if (mode == MODE_VERTICAL || mode == MODE_THEATRE) {
    player.addClass('vt-player');
    $(player.children()[0]).css("height", "100%");

    
    chatParent.resizable().resizable("destroy");
    chatParent.resizable({
      handles: "n",
      resize: function (e, ui) {
        onResize(false);
      },
    });
    chatParent.addClass('vt-chat');

    root.addClass("vertical-enabled");
    // Add root class to indicate vertical theatre mode.
    if (mode == MODE_THEATRE) {
      root.addClass("vertical-theatre-mode");
    } else {
      root.removeClass("vertical-theatre-mode");
    }
    if (isFirstChange) {
      // Seed initial height.
      chatParent.height(totalHeight/2);
    }

    const buttonPathSvg = $("#vertical-button svg g path");
    buttonPathSvg.attr("d", mode == MODE_THEATRE ? FILLED_ICON : UNFILLED_ICON);
    buttonPathSvg.attr(
      "fill-rule",
      mode == MODE_THEATRE ? "evenodd" : "nonzero"
    );

    if (isFirstChange && playerAspectRatio > 0 && isFinite(playerAspectRatio)) {
      // Re-applying: keep the previous split instead of the 50/50 seed.
      onResize(true);
    } else {
      // false: trust the (freshly seeded or previous) chat height and
      // (re)establish the aspect ratio we'll preserve on window resizes.
      onResize(false);
    }

  } else {
    // Clean-up
    root.removeClass("vertical-enabled");
    player.removeClass('vt-player');
    chatParent.removeClass('vt-chat');
    root.removeClass("vertical-theatre-mode");
    // Height is seeded and can be updated by dragger. Top is updated by dragger.
    chatParent.height('');
    chatParent.css('top', '');

    const buttonPathSvg = $("#vertical-button svg g path");
    buttonPathSvg.attr("d", UNFILLED_ICON);
    buttonPathSvg.attr("fill-rule", "evenodd");

    // Toggle chat to force player to resize
    const collapseChatButton = $(
      '[data-a-target="right-column__toggle-collapse-btn"]'
    );
    collapseChatButton.click();
    setTimeout(function() {
      collapseChatButton.click();
    }, 50);
  }

  currentMode = mode;
  saveToStorage('previous', mode);
}

function reapplyMode() {
  // Twitch handles player fullscreen layout; fullscreenchange re-applies on exit.
  if (currentMode == MODE_CLOSED || document.fullscreenElement) {
    return;
  }
  const player = $(PLAYER_SELECTOR);
  const chatParent = $(".chat-shell").parent().parent();
  if (player.length == 0 || chatParent.length == 0) {
    // Not rendered yet; pageObserver will call again.
    return;
  }
  if (player.hasClass('vt-player') && chatParent.hasClass('vt-chat')) {
    return;
  }
  change(currentMode);
}


function addButton(retryCount = 0) {
  if ($("#vertical-button").length > 0) {
    return;
  }

  var videoPlayer = $(".video-player");
  var fullScreenButton = $('[data-a-target="player-fullscreen-button"]');
  if (
    videoPlayer.length == 0 ||
    fullScreenButton.length == 0 ||
    videoPlayer.attr("data-a-player-type") == "frontpage"
  ) {
    if (retryCount < 5) {
      setTimeout(function () {
        addButton(retryCount + 1);
      }, 1000);
    }
    return;
  }

  var buttonParent = fullScreenButton.parent().parent();
  var theatreModeButtonParent = buttonParent.first().prev();
  var theatreModeButton = theatreModeButtonParent.find("button");
  var verticalButtonContainer = $('<div id="vertical-button"/>').insertBefore(
    theatreModeButtonParent
  );

  theatreModeButton.first().clone().appendTo(verticalButtonContainer);
  verticalButtonContainer.find("svg").css("transform", "rotate(90deg)");
  var buttonElement = verticalButtonContainer.find("button");
  buttonElement.attr("data-a-target", "player-vertical-mode-button");
  buttonElement.attr("aria-label", "Vertical Mode");
  verticalButtonContainer.find(".tw-tooltip").text("Vertical Mode");

  buttonElement.click(function () {
    
    const chatContainer = $(".right-column");
    const collapseChatButton = $(
      '[data-a-target="right-column__toggle-collapse-btn"]'
    );
    var timeout = 0;
    if (isHorizontalTheatre()) {
      theatreModeButton.click();
      timeout = 200;
    }

    if (
      chatContainer.attr("data-a-target") == "right-column-chat-bar-collapsed"
    ) {
      // Open up chat first.
      collapseChatButton.click();
      timeout = 200;
    }
    waitAndChange(timeout);
  });
  theatreModeButton.click(function () {
    if (isOpen()) {
      change(MODE_CLOSED);
    }
  });
}

function waitAndChange(timeout, override) {
  setTimeout(function() {
    if (override) {
      change(override);
    } else {
      if (isVertical()) {
        change(MODE_THEATRE);
      } else if (isTheatre()) {
        change(MODE_CLOSED);
      } else {
        change(MODE_VERTICAL);
      }
    }
  }, timeout);
}

function onReady() {
  addButton();

  var target = document.querySelector("title");
  var observer = new MutationObserver(function () {
    addButton();
  });
  var config = {
    childList: true,
  };
  observer.observe(target, config);

  // Re-check after DOM changes, throttled since chat mutates constantly.
  let reapplyScheduled = false;
  const pageObserver = new MutationObserver(function () {
    if (reapplyScheduled) {
      return;
    }
    reapplyScheduled = true;
    setTimeout(function () {
      reapplyScheduled = false;
      reapplyMode();
    }, 250);
  });
  document.addEventListener("fullscreenchange", function () {
    if (document.fullscreenElement) {
      // Step aside (keeping currentMode) so Twitch's layout wins.
      $(PLAYER_SELECTOR).removeClass('vt-player');
      $(".vt-chat").removeClass('vt-chat');
    } else {
      reapplyMode();
    }
  });

  pageObserver.observe(document.getElementById("root"), {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });

  const resizeObserver = new ResizeObserver(() => {
    // true: this is a container/window resize, not a manual chat drag,
    // so preserve the last known player aspect ratio instead of trusting
    // the (now stale) chat panel height.
    onResize(true);
  });
  resizeObserver.observe(document.querySelector(".root-scrollable"));
}

async function restoreOptions() {
  const setting = await getFromStorage('orientation', 'previous')
  const previousMode = await getFromStorage('previous', MODE_CLOSED);
  let mode = MODE_CLOSED;
  if (setting === 'horizontal') {
    mode = MODE_CLOSED;
  } else if (setting === 'vertical') {
    mode = MODE_VERTICAL;
  } else if (setting === 'vertical_theatre') {
    mode = MODE_THEATRE;
  } else if (setting === 'previous') {
    mode = previousMode;
  }
  if (mode !== MODE_CLOSED) {
    currentMode = mode;
    reapplyMode();
  }
};

$(window).ready(function () {
  onReady();
  restoreOptions();
});