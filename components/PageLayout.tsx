"use client";

import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

interface PageLayoutProps {
  children: React.ReactNode;
  showFooter?: boolean;
  showNavbar?: boolean;
  fullWidth?: boolean;
}

const PageLayout = ({ 
  children, 
  showFooter = true, 
  showNavbar = true, 
  fullWidth = false 
}: PageLayoutProps) => {
  return (
    <>
      
      {showNavbar && (
        <div className="w-full sticky top-0 z-50">
          <Navbar />
        </div>
      )}
      
      <main className={fullWidth ? 'w-full' : ''}>
        {children}
      </main>
      
      {showFooter && <Footer />}
    </>
  );
};

export default PageLayout;
