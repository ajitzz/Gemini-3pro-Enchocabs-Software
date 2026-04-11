import type { Testimonial } from '@/lib/data/testimonials';
import s from './Testimonials.module.css';

export default function TestimonialCard({ t }: { t: Testimonial }){
  return (
    <li className={s.card}>
      <div className={s.head}>
         <img
           className={s.avatar}
           src={t.avatar}
           alt={t.name}
           width={120}
           height={120}
           loading="lazy"
         />
        <div>
          <div className={s.name}>
            {t.name} <i className={`fa-solid fa-circle-check ${s.verified}`} aria-label="verified" />
          </div>
          <div className={s.role}>{t.role}</div>
        </div>
      </div>
      <div className={s.stars}>
        <i className="fa-solid fa-star"/><i className="fa-solid fa-star"/><i className="fa-solid fa-star"/><i className="fa-solid fa-star"/><i className="fa-solid fa-star"/>
      </div>
      <div className={s.strong}>Top Weekly Earnings : {t.weekly}</div>
      <div className={s.strong}>Date: {t.date}</div>
      <p className={s.text}>{t.text}</p>
      <a className={s.more} href="#">Read more</a>
    </li>
  );
}
