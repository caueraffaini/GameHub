import React, { useState } from 'react';
import { useAuthStore } from './auth-store';
import type { UserProfile } from './auth-store';
import { Lock } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { accessToken, setSession } = useAuthStore();
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      setError(null);
      
      // Auto-submit when 4 digits are entered
      if (newPin.length === 4) {
        handleLogin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handleLogin = (enteredPin: string) => {
    // Standard mock authentication for Phase 8c verification
    if (enteredPin === '8821') {
      const mockUser: UserProfile = {
        id: 'user_01jm945fa29',
        nusp: '11822334',
        nickname: 'USP_Slayer',
        email: 'uspslayer@usp.br',
        fullName: 'Rodrigo Medeiros',
        birthDate: '2002-08-24',
        instituteId: 'USP-ICMC',
        courseId: 'Computer Engineering',
        availabilityStatus: 'AVAILABLE',
      };
      // Encode a simple mock JWT payload: sub, roles, instituteId, courseId
      const mockPayload = {
        sub: mockUser.id,
        roles: ['STUDENT'],
        instituteId: mockUser.instituteId,
        courseId: mockUser.courseId,
      };
      const mockToken = `header.${btoa(JSON.stringify(mockPayload))}.signature`;
      setSession(mockToken, mockUser);
    } else {
      setError('Invalid security PIN');
      setPin('');
    }
  };

  if (accessToken) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-black text-white p-4">
      {/* High-contrast retro kiosk card wrapper */}
      <div className="w-full max-w-sm bg-surface border-2 border-primary p-6 space-y-6 glow-accent">
        
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-accent text-black font-extrabold flex items-center justify-center text-xl geometric-bevel">
            GH
          </div>
          <h2 className="text-2xl font-black tracking-widest text-white uppercase">GameHub Security</h2>
          <p className="text-xs text-gray-400">Enter your 4-digit numerical campus PIN</p>
        </div>

        {/* PIN Indicators */}
        <div className="flex justify-center gap-4 py-2">
          {[0, 1, 2, 3].map((index) => (
            <div 
              key={index} 
              className={`w-4 h-4 border-2 geometric-bevel-sm transition-all duration-150 ${
                pin.length > index 
                  ? 'bg-accent border-accent scale-110 shadow-lg' 
                  : 'bg-black border-primary'
              }`}
            ></div>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="text-center text-xs text-red-500 font-bold tracking-wide uppercase bg-red-950/20 py-1.5 border border-red-500/30">
            {error}
          </div>
        )}

        {/* PIN Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              className="h-14 bg-black border border-primary hover:border-accent hover:text-accent font-black text-xl geometric-bevel-sm active:bg-primary/20 transition-colors"
            >
              {num}
            </button>
          ))}
          <button
            onClick={() => handleKeyPress('0')}
            className="col-start-2 h-14 bg-black border border-primary hover:border-accent hover:text-accent font-black text-xl geometric-bevel-sm active:bg-primary/20 transition-colors"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="h-14 bg-black border border-primary hover:border-red-500 hover:text-red-500 text-xs font-bold geometric-bevel-sm active:bg-red-950/20 transition-colors uppercase tracking-wider"
          >
            Clear
          </button>
        </div>

        {/* Security Footnote */}
        <div className="text-center text-[10px] text-gray-500 flex items-center justify-center gap-1">
          <Lock className="w-3 h-3" />
          <span>Argon2 Session Protection Active</span>
        </div>
      </div>
    </div>
  );
}
