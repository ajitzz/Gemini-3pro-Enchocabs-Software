import s from './Salary.module.css';
import Collapsible from '@/components/Collapsible/Collapsible';
import Image from 'next/image';
export default function Salary() {
  const defaultContent = `We provide full support to every  Staffs. Encho Cabs offers training on routes and app usage, guidance on how to work safely and efficiently, and continuous phone and road assistance whenever needed. For drivers coming from other cities, we help ensure a good standard of living, including safe accommodation. Every driver is our responsibility, and we treat each one with respect, care, and professionalism.`

  return (
    <section id="salary" className={s.section} aria-label="Salary Plan">
      <div className={`container ${s.grid}`}>
        <div className={s.frame}>
          {/* <iframe
            src="https://www.youtube.com/shorts/4BiAYfkFkyI"
            title="Salary Plan Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          /> */}
               <div className="relative w-full h-full">
            <Image
          src="https://i.ibb.co/fYBPKpR5/Gemini-Generated-Image-n81s2un81s2un81s-1.png" alt="Gemini-Generated-Image-n81s2un81s2un81s-1" 
              fill
              className="object-cover"
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
