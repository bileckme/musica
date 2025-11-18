import { useState, useEffect } from "react";

export default function App() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => setStatus(data));
  }, []);

  return (
    null
  );
}