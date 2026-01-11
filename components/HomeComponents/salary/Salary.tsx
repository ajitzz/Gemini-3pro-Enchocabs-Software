import s from './Salary.module.css';
import Collapsible from '@/components/HomeComponents/Collapsible/Collapsible';
export default function Salary() {
  const defaultContent = `We provide full support to every  Staffs. Encho Cabs offers training on routes and app usage, guidance on how to work safely and efficiently, and continuous phone and road assistance whenever needed. For drivers coming from other cities, we help ensure a good standard of living, including safe accommodation. Every driver is our responsibility, and we treat each one with respect, care, and professionalism.`

  return (
    <section id="salary" className={`flex flex-col items-center justify-center bg-white py-20 text-neutral-900 sm:py-24 ${s.section}` } aria-label="Salary Plan">
      <div className={`container ${s.grid}`}>
        <div className={s.frame}>
          {/* <iframe
            src="https://www.youtube.com/shorts/4BiAYfkFkyI"
            title="Salary Plan Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          /> */}
          <div className="relative w-full h-full">
            <img
              src="https://i.ibb.co/fYBPKpR5/Gemini-Generated-Image-n81s2un81s2un81s-1.png"
              alt="Gemini generated driver support illustration"
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          
        </div>

        <div className={s.text}>
          <h2 className={s.h2}>OUR SUPPORT</h2>
        <Collapsible
  defaultContent={defaultContent}
 
/>
        </div>
      </div>
    </section>
  );
}
