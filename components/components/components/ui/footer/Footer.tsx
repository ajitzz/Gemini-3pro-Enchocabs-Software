'use client';
import { useEffect, useRef } from 'react';
import s from './Footer.module.css';

export default function Footer(){
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if(!el || !('IntersectionObserver' in window)) return;
    const revealEls = el.querySelectorAll(`.${s.reveal}`);
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add(s.in); io.unobserve(e.target as Element); }});
    },{threshold:.12});
    revealEls.forEach((n)=>io.observe(n));
    return () => io.disconnect();
  }, []);

  return (
    <footer ref={rootRef} id="footer" className={`light ${s.footer}`} aria-label="ENCHO Footer">
      <div className="container">
        <div className={s.grid}>
          <div className={`${s.brand} ${s.reveal}`}><div className={s.brandLg}>ENCHO</div></div>
          <div className={`${s.contacts} ${s.reveal}`}>
            <div className={s.rows}>
              <div className={s.label}>Rental</div><div>Tel: +91-6364704396</div>
              <div className={s.label}>Salary</div><div>Email: <a href="mailto:enchoenterprises@gmail.com">enchoenterprises@gmail.com</a></div>
              <div className={s.label}>About</div><div>Location: Bangalore</div>
            </div>
          </div>
          <div className={`${s.subscribe} ${s.reveal}`}>
            <h4>SUBSCRIBE</h4>
            <p>Sign up to receive Autono news and updates.</p>
            <form className={s.form} onSubmit={(e)=>{e.preventDefault(); alert('Thanks for subscribing!');}}>
              <label htmlFor="sub-email" className="sr-only">Email</label>
              <input id="sub-email" type="email" placeholder="Email *" required />
              <button type="submit">Subscribe</button>
            </form>
            <label className={s.check}><input type="checkbox" /> Yes, subscribe me to your newsletter.*</label>
          </div>
        </div>
        <div className={s.bottom}>
          <div>© 2023 by Encho Enterprises</div>
          <div className={s.social} aria-label="Social links">
            <a href="#"><i className="fa-brands fa-linkedin-in"/></a>
            <a href="#"><i className="fa-brands fa-facebook-f"/></a>
            <a href="#"><i className="fa-brands fa-x-twitter"/></a>
            <a href="#"><i className="fa-brands fa-instagram"/></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
