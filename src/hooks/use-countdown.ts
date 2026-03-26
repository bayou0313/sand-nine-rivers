import { useState, useEffect } from "react";

export const useCountdown = () => {
  const [timeLeft, setTimeLeft] = useState("");
  const [label, setLabel] = useState("");
  const [nextDay, setNextDay] = useState("");

  useEffect(() => {
    const calculate = () => {
      const now = new Date();
      const day = now.getDay(); // 0=Sun, 1=Mon...6=Sat
      const hours = now.getHours();
      const cutoffHour = 10;

      let target = new Date(now);
      let newLabel = "";
      let newNextDay = "";

      const isBefore10 = hours < cutoffHour;

      if (day === 0) {
        // Sunday → Monday 10 AM
        target.setDate(target.getDate() + 1);
        target.setHours(cutoffHour, 0, 0, 0);
        newLabel = "MONDAY DELIVERY CLOSES IN";
        newNextDay = "Monday";
      } else if (day === 6) {
        // Saturday
        if (isBefore10) {
          target.setHours(cutoffHour, 0, 0, 0);
          newLabel = "SATURDAY DELIVERY CLOSES IN";
          newNextDay = "today";
        } else {
          // Saturday after 10 → Monday
          target.setDate(target.getDate() + 2);
          target.setHours(cutoffHour, 0, 0, 0);
          newLabel = "MONDAY DELIVERY CLOSES IN";
          newNextDay = "Monday";
        }
      } else {
        // Weekday (Mon-Fri)
        if (isBefore10) {
          target.setHours(cutoffHour, 0, 0, 0);
          newLabel = "SAME-DAY DELIVERY CLOSES IN";
          newNextDay = "today";
        } else if (day === 5) {
          // Friday after 10 → Monday
          target.setDate(target.getDate() + 3);
          target.setHours(cutoffHour, 0, 0, 0);
          newLabel = "MONDAY DELIVERY CLOSES IN";
          newNextDay = "Monday";
        } else {
          // Mon-Thu after 10 → tomorrow
          target.setDate(target.getDate() + 1);
          target.setHours(cutoffHour, 0, 0, 0);
          newLabel = "TOMORROW'S DELIVERY CLOSES IN";
          newNextDay = "tomorrow";
        }
      }

      const diff = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;

      setTimeLeft(`${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`);
      setLabel(newLabel);
      setNextDay(newNextDay);
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, []);

  return { timeLeft, label, nextDay };
};
