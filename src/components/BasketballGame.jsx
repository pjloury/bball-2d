import React, { useState, useEffect, useRef } from 'react';

const BasketballGame = () => {
  const [ballPos, setBallPos] = useState({ x: 100, y: 350 });
  const [isMoving, setIsMoving] = useState(false);
  const [time, setTime] = useState(0);
  const [score, setScore] = useState(0);
  const [power, setPower] = useState(0);
  const [holding, setHolding] = useState(false);
  const [currentVelocity, setCurrentVelocity] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [rotationSpeed, setRotationSpeed] = useState(0);
  const scoredRef = useRef(false);  // Using ref instead of state for immediate updates
  const [shotLabel, setShotLabel] = useState('');
  const [hitBackboard, setHitBackboard] = useState(false);
  const [hitRim, setHitRim] = useState(false);
  const [makes, setMakes] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const attemptInProgressRef = useRef(false);  // Track if shot is in progress

  // Game constants
  const PERFECT_VELOCITY_X = 12;
  const PERFECT_VELOCITY_Y = -18;
  const GRAVITY = 0.4;
  const POWER_RATE = 2.0;
  const POINTS_PER_BASKET = 3;
  const BOUNCE_DAMPING = 0.89;    // Increased from 0.85 for more bounce
  const GROUND_FRICTION = 0.98;   // Increased from 0.95 for smoother rolling
  const MIN_SPEED = 0.1;
  const RESET_DELAY = 1500;
  const INITIAL_ROTATION_SPEED = 15;

  // Rim dimensions and center
  const RIM_FRONT = 550;
  const RIM_BACK = 598;
  const RIM_Y = 180;
  const RIM_CENTER_X = (RIM_FRONT + RIM_BACK) / 2;
  const BALL_RADIUS = 15;
  const RIM_WIDTH = 48;
  const SCORING_X = 620;  // New constant based on where scoring actually occurs
  const ALLOWED_OFFSET = 15;  // Adjusted scoring window

  // Handle spacebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        // Only allow starting a new shot if ball isn't moving
        if (!isMoving) {
          setHolding(true);
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space' && holding) {
        e.preventDefault();
        const powerFactor = power / 100;
        setCurrentVelocity({
          x: PERFECT_VELOCITY_X * powerFactor,
          y: PERFECT_VELOCITY_Y * powerFactor
        });
        setHolding(false);
        setIsMoving(true);
        setTime(0);
        attemptInProgressRef.current = true;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isMoving, holding, power]);

  // Power meter
  useEffect(() => {
    let powerInterval;
    if (holding && !isMoving) {
      powerInterval = setInterval(() => {
        setPower(prev => {
          if (prev >= 100) return 0;
          return prev + POWER_RATE;
        });
      }, 20);
    } else if (!holding) {
      setPower(0);
    }
    return () => clearInterval(powerInterval);
  }, [holding, isMoving]);

  // Add shot timer
  useEffect(() => {
    let resetTimer;
    if (isMoving) {
      resetTimer = setTimeout(() => {
        setBallPos({ x: 100, y: 350 });
        setIsMoving(false);
        setTime(0);
        setCurrentVelocity({ x: 0, y: 0 });
        if (attemptInProgressRef.current) {
          // Update makes and attempts together at end of shot
          if (scoredRef.current) {
            setMakes(m => m + 1);
          }
          setAttempts(a => a + 1);
          attemptInProgressRef.current = false;
          scoredRef.current = false;
        }
      }, RESET_DELAY);
    }
    return () => clearTimeout(resetTimer);
  }, [isMoving]);

  // Ball physics with collisions
  useEffect(() => {
    let frameId;
    
    const updatePosition = () => {
      if (isMoving) {
        setTime(t => t + 1);
        setRotation(r => r + rotationSpeed);
        setBallPos(pos => {
          const newPos = {
            x: pos.x + currentVelocity.x,
            y: pos.y + currentVelocity.y + (GRAVITY * time)
          };

          // Ground collision - show MISS if we hit ground without scoring
          if (newPos.y > 350) {
            newPos.y = 350;
            if (!scoredRef.current) {
              setShotLabel('MISS!');
              setTimeout(() => {
                setShotLabel('');
              }, 1000);
            }
            setCurrentVelocity(v => ({
              x: v.x * GROUND_FRICTION,
              y: -v.y * BOUNCE_DAMPING
            }));
            setRotationSpeed(rs => rs * GROUND_FRICTION);
            setTime(0);
          }

          // Wall collisions - both right and left walls
          if (newPos.x > 620) {  // Right wall
            newPos.x = 620;
            setCurrentVelocity(v => ({
              x: -v.x * BOUNCE_DAMPING, 
              y: v.y * BOUNCE_DAMPING 
            }));
            setRotationSpeed(rs => -rs * BOUNCE_DAMPING);
          } else if (newPos.x < 30) {  // Left wall
            newPos.x = 30;
            setCurrentVelocity(v => ({
              x: -v.x * BOUNCE_DAMPING, 
              y: v.y * BOUNCE_DAMPING 
            }));
            setRotationSpeed(rs => -rs * BOUNCE_DAMPING);
          }

          // Backboard collision with improved physics
          if (newPos.x > 630 && pos.y > 160 && pos.y < 240) {
            newPos.x = 628;
            const impactForce = Math.abs(currentVelocity.x);
            if (impactForce > 8) {
              setCurrentVelocity(v => ({
                x: -v.x * BOUNCE_DAMPING * 0.9,
                y: v.y * 0.95 - 2
              }));
            } else {
              setCurrentVelocity(v => ({
                x: -v.x * BOUNCE_DAMPING * 0.8,
                y: v.y * 0.95
              }));
            }
            setHitBackboard(true);
          }

          // Rim collisions with improved physics
          if (newPos.y > RIM_Y - 20 && newPos.y < RIM_Y + 20) {
            // Ball hitting front of rim
            if (newPos.x + BALL_RADIUS > RIM_FRONT && newPos.x - BALL_RADIUS < RIM_FRONT && pos.x - BALL_RADIUS <= RIM_FRONT) {
              newPos.x = RIM_FRONT - BALL_RADIUS;
              setCurrentVelocity(v => ({
                x: -v.x * BOUNCE_DAMPING * 0.8,  // Reduced from 1.2 to 0.8
                y: v.y * 0.95 - 1.5
              }));
            }
            // Ball hitting back of rim
            else if (newPos.x + BALL_RADIUS > RIM_BACK && newPos.x - BALL_RADIUS < RIM_BACK && pos.x + BALL_RADIUS >= RIM_BACK) {
              newPos.x = RIM_BACK + BALL_RADIUS;
              setCurrentVelocity(v => ({
                x: -v.x * BOUNCE_DAMPING * 0.8,  // Reduced from 1.2 to 0.8
                y: v.y * 0.95 - 1.5
              }));
            }
            setHitRim(true);
          }

          // Debug logging with relative positions
          if (Math.abs(newPos.y - RIM_Y) < 50) {
            console.log('Ball Position:', {
              yDistanceFromRim: (RIM_Y - newPos.y).toFixed(1),
              xDistanceFromCenter: (SCORING_X - newPos.x).toFixed(1),
              willScore: !scoredRef.current && 
                        ((pos.y <= RIM_Y && newPos.y >= RIM_Y) ||
                         (pos.y >= RIM_Y && newPos.y <= RIM_Y)) &&
                        Math.abs(newPos.x - SCORING_X) < ALLOWED_OFFSET
            });
          }

          // Score detection at the actual scoring position
          if (!scoredRef.current && 
              ((pos.y <= RIM_Y && newPos.y >= RIM_Y) ||
               (pos.y >= RIM_Y && newPos.y <= RIM_Y)) &&
              Math.abs(newPos.x - SCORING_X) < ALLOWED_OFFSET) {
            setScore(s => s + POINTS_PER_BASKET);
            scoredRef.current = true;  // Just mark that we scored, don't update makes yet
            
            // Set shot label based on how it went in
            if (!hitBackboard && !hitRim) {
              setShotLabel('SWISH!');
            } else if (hitBackboard) {
              setShotLabel('BANK!');
            } else {
              setShotLabel('SCORE!');
            }
            
            setTimeout(() => {
              setShotLabel('');
            }, 1000);
          }

          return newPos;
        });
        
        frameId = requestAnimationFrame(updatePosition);
      }
    };

    if (isMoving) {
      frameId = requestAnimationFrame(updatePosition);
    }

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [isMoving, time, currentVelocity, rotationSpeed]);

  return (
    <div className="min-h-screen bg-white flex justify-center items-center">
      <div className="relative w-[650px] h-[400px] bg-gray-900 border-2 border-gray-700">
        {/* Shot Label */}
        {shotLabel && (
          <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-4xl font-bold text-white z-10">
            {shotLabel}
          </div>
        )}

        {/* Score and Accuracy */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start text-white">
          <div className="flex flex-col">
            <div className="text-2xl font-bold">Score: {score}</div>
            <div className="text-xl">
              {makes} / {attempts} ({attempts > 0 ? Math.round((makes/attempts) * 100) : 0}%)
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-sm">
              Hold SPACEBAR to set power - More power = longer shot!
            </div>
            <div className="w-32 h-6 border-2 border-white bg-black">
              <div
                className="h-full transition-all duration-75"
                style={{ 
                  width: `${power}%`,
                  backgroundColor: '#22c55e'
                }}
              />
            </div>
          </div>
        </div>

        {/* Ball */}
        <div
          className="absolute text-4xl transition-transform"
          style={{
            left: `${ballPos.x}px`,
            top: `${ballPos.y}px`,
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`
          }}
        >
          🏀
        </div>

        {/* 3pt Line Indicator */}
        <div className="absolute text-white font-bold" style={{ left: '150px', bottom: '10px' }}>
          |
          <br />
          3pts
        </div>

        {/* Floor */}
        <div className="absolute bottom-0 w-full h-1 bg-gray-700" />

        {/* Hoop */}
        <div className="absolute" style={{ right: '50px', top: '180px' }}>
          <div className="relative">
            {/* Backboard */}
            <div className="absolute h-24 w-1 bg-white" 
                 style={{ left: '48px', top: '-90px' }} />
            
            {/* Rim */}
            <div className="absolute w-12 h-1 bg-red-500" />
            
            {/* Post */}
            <div className="absolute w-1 h-40 bg-yellow-500 left-12" />
            
            {/* Wastebasket */}
            <div className="absolute text-4xl transform scale-150" 
                 style={{ left: '0px', top: '0px' }}>
              🗑️
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BasketballGame;