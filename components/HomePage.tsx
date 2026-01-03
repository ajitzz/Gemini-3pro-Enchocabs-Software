
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

   <div className="flex flex-col items-center justify-center bg-white py-20 text-neutral-900 sm:py-24">
      <Hero />
      <Vision />
      <Services />
      <Rental />
      <PartTime/>
      <Salary />
      <Parallax />
      <Numbers />
     <Testimonials items={[]} autoplay interval={3500} />
      <Footer />
    </div>
 
  );
}
