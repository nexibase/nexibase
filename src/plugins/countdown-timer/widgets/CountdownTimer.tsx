'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock } from 'lucide-react';

interface CountdownTimerProps {
  settings?: {
    eventName?: string;
    targetDate?: string;
    completionMessage?: string;
    linkUrl?: string;
    linkNewTab?: boolean;
  };
}

export default function CountdownTimer({ settings }: CountdownTimerProps) {
  const eventName = settings?.eventName || 'Special Event';
  const targetDate = settings?.targetDate || '';
  const completionMessage = settings?.completionMessage || '🎉 Event has started!';
  const linkUrl = settings?.linkUrl || '';
  const linkNewTab = Boolean(settings?.linkNewTab);
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!targetDate) return;
    const calculateTimeLeft = () => {
      const difference = new Date(targetDate).getTime() - Date.now();

      if (difference <= 0) {
        setIsComplete(true);
        return null;
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  if (!targetDate) {
    return (
      <div className="w-full rounded-lg bg-gradient-to-r from-slate-500 to-slate-700 p-8 text-center shadow-lg">
        <div className="text-white">
          <Calendar className="mx-auto mb-3 h-8 w-8 opacity-70" />
          <div className="text-lg font-semibold">{eventName}</div>
          <div className="mt-2 text-sm text-white/80">Please set a target date in the widget settings</div>
        </div>
      </div>
    );
  }

  const wrapLink = (content: React.ReactNode) => {
    if (!linkUrl) return content;
    return (
      <a
        href={linkUrl}
        target={linkNewTab ? '_blank' : undefined}
        rel={linkNewTab ? 'noopener noreferrer' : undefined}
        className="block transition-transform hover:scale-[1.01]"
      >
        {content}
      </a>
    );
  };

  if (isComplete) {
    return wrapLink(
      <div className="w-full rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-center shadow-lg">
        <div className="text-4xl font-bold text-white animate-bounce">
          {completionMessage}
        </div>
      </div>
    );
  }

  if (!timeLeft) {
    return (
      <div className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 p-8 text-center shadow-lg">
        <div className="text-white">Loading countdown...</div>
      </div>
    );
  }

  const timeUnits = [
    { label: 'Days', value: timeLeft.days },
    { label: 'Hours', value: timeLeft.hours },
    { label: 'Minutes', value: timeLeft.minutes },
    { label: 'Seconds', value: timeLeft.seconds },
  ];

  return wrapLink(
    <div className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 p-8 shadow-lg">
      <div className="mb-6 flex items-center justify-center gap-2 text-white">
        <Calendar className="h-6 w-6" />
        <h3 className="text-2xl font-bold">{eventName}</h3>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {timeUnits.map((unit) => (
          <div
            key={unit.label}
            className="rounded-lg bg-white/20 backdrop-blur-sm p-4 text-center"
          >
            <div className="text-4xl font-bold text-white tabular-nums">
              {String(unit.value).padStart(2, '0')}
            </div>
            <div className="mt-2 text-sm font-medium text-white/90">
              {unit.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 text-white/80">
        <Clock className="h-4 w-4" />
        <span className="text-sm">
          Target: {new Date(targetDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      </div>
    </div>
  );
}
