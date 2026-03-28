import { useEffect, useState } from "react";

export function useDarkMode() {
  const [dark, setDark] = useState(
    () => localStorage.getItem("pulseride_dark") === "1",
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("pulseride_dark", dark ? "1" : "0");
  }, [dark]);
  return [dark, setDark] as const;
}
