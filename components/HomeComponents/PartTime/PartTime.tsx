import Collapsible from "@/components/HomeComponents/Collapsible/Collapsible";
// import PremiumWhatYouGetCard from "@/components/PremiumWhatYouGetCard/PremiumWhatYouGetCard";
import s from './PartTime.module.css';

export default function PartTime() {
  const defaultContent = `We are launching a student partner program where  students can take a WagonR CNG car on a daily rental and work part-time with Uber. After fuel and basic expenses, each car is expected to generate around ₹3,000–₹5,000 per day fro vehicle, which the students can share among themselves. The program is designed with flexible timings so that driving does not clash with classes, assignments, or exams. We also guide and monitor students for the first week to help them get started and test their performance, and all payments from Uber go directly to the students’ bank accounts, giving them full control over their earnings.`
  return (
 <section id="partTime" className=" flex flex-col items-center justify-center bg-white py-20 text-neutral-900 sm:py-24" aria-label="partTime Plan">
      <div className="container space-y-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gray-500">Part-Time Plan</p>
            <h2 className="text-3xl font-semibold text-neutral-900 sm:text-4xl">Student Plan: Earn While You Learn</h2>
              <Collapsible
  defaultContent={defaultContent}
  className="text-base text-neutral-700"
  previewSentences={5}
/>

          </div>
 <div className="flex justify-center lg:justify-end">
           <div className={s.frame}>
          {/* <iframe
            src="https://www.youtube.com/shorts/4BiAYfkFkyI"
            title="Salary Plan Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          /> */}
          <div className="relative w-full h-full">
            <img
              src="https://i.ibb.co/q32DfMRb/Untitled-design-4.jpg"
              alt="Student driving program"
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
</div>
      

        </div>


         </div>
    </section>
  );
}
