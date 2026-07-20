import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import BikeListing from './pages/BikeListing';
import BikeDetail from './pages/BikeDetail';
import Offers from './pages/Offers';
import Finance from './pages/Finance';
import About from './pages/About';
import Contact from './pages/Contact';

export default function App() {
  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 flex flex-col font-sans selection:bg-[#0066CC] selection:text-white">
      <Navbar />
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/bikes" element={<BikeListing />} />
          <Route path="/bikes/:id" element={<BikeDetail />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
