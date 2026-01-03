
import Hero from './HomeComponents/hero/Hero';
import Vision from './HomeComponents/vision/Vision';
import Services from './HomeComponents/services/Services';
import Rental from './HomeComponents/rental/Rental';
import Salary from './HomeComponents/salary/Salary';
import Parallax from './HomeComponents/parallax/Parallax';
import Numbers from './HomeComponents/numbers/Numbers';
import Testimonials from './HomeComponents/testimonials/Testimonials';
import Footer from './HomeComponents/footer/Footer';
import PartTime from './HomeComponents/PartTime/PartTime';
export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-screen-2xl flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl">
        <div className="flex flex-col divide-y divide-neutral-200">
          <Hero />
          <Vision />
          <Services />
          <Rental />
          <PartTime />
          <Salary />
          <Parallax />
          <Numbers />
          <Testimonials items={[]} autoplay interval={3500} />
          <Footer />
        </div>
      </div>
    </main>
  );
}
