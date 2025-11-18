import { useEffect, useRef } from "react";

export default function PianoCanvas() {
  const canvasRef = useRef();

  useEffect(() => {
    // load the original script logic
    const script = document.createElement("script");
    script.src = "/assets/js/piano.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return <canvas id="pianoCanvas" ref={canvasRef}></canvas>;
}

