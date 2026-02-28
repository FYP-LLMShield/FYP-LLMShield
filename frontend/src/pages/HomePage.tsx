import React from 'react';
import Hero from '../components/home/Hero';
import Features from '../components/home/Features';
import Stats from '../components/home/Stats';
import HowItWorks from '../components/home/HowItWorks';
import Testimonials from '../components/home/Testimonials';
import CTA from '../components/home/CTA';

const HomePage: React.FC = () => {
  return (
    <div className="page-transition">
      <Hero />
      <Features />
      <Stats />
      <HowItWorks />
      <Testimonials />
      <CTA />
    </div>
  );
};

export default HomePage;
