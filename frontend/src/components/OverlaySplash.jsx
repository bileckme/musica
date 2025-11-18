export default function OverlaySplash() {
  return (
    <div id="overlay">
      <img src="/assets/images/logo.png"
           alt="logo"
           style={{ width: 160, height: 160, objectFit: "contain" }} />

      <div id="loading-text"
           style={{ color: "white", fontSize: "1.2em", marginTop: 20 }}>
        🎹 Loading samples... 0%
      </div>
    </div>
  );
}

