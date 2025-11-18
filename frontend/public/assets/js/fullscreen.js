// fullscreen.js

document.addEventListener("DOMContentLoaded", () => {
  const fsBtn = document.getElementById("fullscreenToggle");

  if (!fsBtn) {
    console.warn("⚠️ Fullscreen button not found in previewer.");
    return;
  }

  function toggleFullscreen() {
    const parentDoc = window.parent.document;
    const rootElement = parentDoc.documentElement;

    // Check if parent is currently fullscreen
    const isFullscreen =
      parentDoc.fullscreenElement ||
      parentDoc.webkitFullscreenElement ||
      parentDoc.msFullscreenElement;

    try {
      if (!isFullscreen) {
        // Enter fullscreen
        if (rootElement.requestFullscreen) rootElement.requestFullscreen();
        else if (rootElement.webkitRequestFullscreen)
          rootElement.webkitRequestFullscreen();
        else if (rootElement.msRequestFullscreen)
          rootElement.msRequestFullscreen();

        fsBtn.innerHTML = 'Exit Fullscreen <i class="fas fa-compress"></i>';
        console.log("🖥️ Entered fullscreen mode (parent)");
      } else {
        // Exit fullscreen
        if (parentDoc.exitFullscreen) parentDoc.exitFullscreen();
        else if (parentDoc.webkitExitFullscreen)
          parentDoc.webkitExitFullscreen();
        else if (parentDoc.msExitFullscreen)
          parentDoc.msExitFullscreen();

        fsBtn.innerHTML = 'Fullscreen <i class="fas fa-expand"></i>';
        console.log("🖥️ Exited fullscreen mode (parent)");
      }
    } catch (err) {
      console.error("❌ Fullscreen toggle failed:", err);
    }
  }

  fsBtn.addEventListener("click", toggleFullscreen);

  // Sync button icon when fullscreen changes
  window.parent.document.addEventListener("fullscreenchange", () => {
    const isNowFullscreen = !!window.parent.document.fullscreenElement;
    fsBtn.innerHTML = isNowFullscreen
      ? 'Exit Fullscreen <i class="fas fa-compress"></i>'
      : 'Fullscreen <i class="fas fa-expand"></i>';
  });
});
