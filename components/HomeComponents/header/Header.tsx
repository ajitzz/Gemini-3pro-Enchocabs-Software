'use client';
import s from './Header.module.css';

export default function Header(){
  const toggle = () => {
    document.getElementById('nav')?.classList.toggle(s.open);
  };

  return (
    <header className={s.header}>
      <div id="nav" className={`container ${s.nav}`}>
        <a href="#/" className={s.brand}>ENCHO</a>

        <ul className={s.menu}>
           <a href="#/" className=" h-full flex justify-start">
           Home
           </a>
           <a href="#/performance" className=" h-full flex justify-start">
           Earnings
           </a>
            <a href="#/about" className=" h-full flex justify-start">
           About
           </a>
           {/* <Link href={"/drivers"} className=" h-full flex justify-start">
           Register
           </Link> */}
           {/* <Link href={"/weekly/add"} className=" h-full flex justify-start">
           Entry
           </Link>
            <Link href={"/weekly/manage"} className=" h-full flex justify-start">
           Manage
           </Link> */}
        </ul>
        <div className={s.actions}>
          <a className={s.call} href="tel:+9163647604396">
            <i className="fa-solid fa-phone" /><span>+91·63647604396</span>
          </a>
          <button aria-label="Open menu" onClick={toggle} className={s.burger}>
            <i className="fa-solid fa-bars" />
          </button>
        </div>
      </div>
    </header>
  );
}
