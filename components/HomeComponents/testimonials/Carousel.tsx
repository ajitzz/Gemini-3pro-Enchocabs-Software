'use client';
import React from 'react';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import s from './Testimonials.module.css';

type Props = { children: React.ReactNode };

export default function Carousel({ children }: Props){
  const trackRef = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [show, setShow] = useState(3);
  const GAP = 24;

  // duplicate children for loop-like behavior
  const slides = useMemo(() => {
    const arr = (Array.isArray(children) ? children : [children]) as React.ReactNode[];
    return [...arr, ...arr];
  }, [children]);

  const recalc = () => {
    const w = window.innerWidth;
    setShow(w < 640 ? 1 : w < 1024 ? 2 : 3);
  };

  useEffect(() => {
    recalc();
    const onResize = () => { recalc(); setIndex(0); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const next = useCallback(() => setIndex(i => (i + show) % slides.length), [show, slides.length]);
  const prev = useCallback(() => setIndex(i => (i - show + slides.length) % slides.length), [show, slides.length]);

  useEffect(() => {
    const id = setInterval(next, 4000);
    return () => clearInterval(id);
  }, [next]);

  const page = Math.floor(index / show);
  const pages = Math.ceil(slides.length / show);

  // translate track
  useEffect(() => {
    const track = trackRef.current;
    if(!track) return;
    const first = track.children[0] as HTMLElement | undefined;
    if(!first) return;
    const cardW = first.getBoundingClientRect().width;
    const offset = (cardW + GAP) * index;
    track.style.transition = 'transform .6s ease';
    track.style.transform = `translateX(${-offset}px)`;
  }, [index, show, slides.length]);

  return (
    <div className={s.carousel}>
      <button aria-label="Previous" className={`${s.arrow} ${s.prev}`} onClick={prev}>
        <i className="fa-solid fa-chevron-left"/>
      </button>

      <div className={s.viewport}>
        <ul className={s.track} ref={trackRef}>
          {slides}
        </ul>
      </div>

      <button aria-label="Next" className={`${s.arrow} ${s.next}`} onClick={next}>
        <i className="fa-solid fa-chevron-right"/>
      </button>

      <div className={s.dots} aria-label="carousel indicators">
        {Array.from({length: pages}).map((_,i)=>(
          <button key={i}
            className={`${s.dot} ${i===page ? s.active : ''}`}
            onClick={()=>setIndex(i*show)}
            aria-label={`Go to slide ${i+1}`}
          />
        ))}
      </div>
    </div>
  );
}
