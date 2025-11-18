import PianoCanvas from "../components/PianoCanvas.jsx";
import OverlaySplash from "../components/OverlaySplash.jsx";
import NoteInfo from "../components/NoteInfo.jsx";
import ReadyIndicator from "../components/ReadyIndicator.jsx";
import "../assets/css/main.css";

export default function Home() {
  return (
    <>
      <OverlaySplash />

      <iframe
        id="previewFrame"
        src="/previewer.html"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "88%",
          border: "none",
          background: "#111",
          zIndex: 1
        }}
      ></iframe>

      <NoteInfo />
      <ReadyIndicator />

      <div className="piano-area">
        <PianoCanvas />
      </div>
    </>
  );
}

