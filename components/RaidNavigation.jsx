import React, { useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';

const RaidNavigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeRaid, setActiveRaid] = useState('Molten Core');

  const raids = [
    'Sunken Temple', 'World Bosses', 'Onyxia', 'Molten Core', 
    'Blackwing Lair', 'Zul Gurub', 'Crystal Vale', 'Lil AQ',
    'Big AQ', 'Nightmare Grove'
  ];

  return (
    <div className="w-full bg-gradient-to-b from-gray-900 to-gray-800 border-b-2 border-amber-700 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-2 gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1 items-center flex-grow">
          {raids.map(raid => (
            <button
              key={raid}
              className={`px-3 py-2 text-sm font-semibold rounded transition-all
                ${activeRaid === raid 
                  ? 'bg-red-900 text-yellow-400 shadow-lg scale-105 border-2 border-yellow-600' 
                  : 'bg-blue-900 text-yellow-200 hover:bg-blue-800 border border-blue-700'}
                transform hover:scale-105 hover:shadow-md`}
              onClick={() => setActiveRaid(raid)}
            >
              {raid}
            </button>
          ))}
        </div>
        
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-b from-amber-900 to-amber-950 
              text-yellow-400 rounded border-2 border-yellow-600 hover:from-amber-800 hover:to-amber-900
              transition-all transform hover:scale-105"
          >
            <span>Raid Dates</span>
            <ChevronDownIcon size={16} />
          </button>
          
          {isOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-gray-900 border-2 border-amber-700 
              rounded shadow-lg z-50">
              <div className="py-1">
                {['2024-01-20', '2024-01-15', '2024-01-10'].map(date => (
                  <button
                    key={date}
                    className="block w-full px-4 py-2 text-left text-yellow-200 hover:bg-gray-800"
                    onClick={() => setIsOpen(false)}
                  >
                    {date}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RaidNavigation;
