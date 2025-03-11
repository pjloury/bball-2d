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
  const hitBackboardRef = useRef(false);  // Changed from state to ref
  const [hitRim, setHitRim] = useState(false);
  const [makes, setMakes] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const attemptInProgressRef = useRef(false);  // Track if shot is in progress
  const containerRef = useRef(null);  // Add ref for container

  // Game constants
  const PERFECT_VELOCITY_X = 12;  // Increased from 12 for more horizontal distance
  const PERFECT_VELOCITY_Y = -21;  // Increased from -18 for higher arc
  const GRAVITY = 0.4;
  const POWER_RATE = 1.9;
  const POINTS_PER_BASKET = 3;
  const BOUNCE_DAMPING = 0.89;    // Increased from 0.85 for more bounce
  const GROUND_FRICTION = 0.98;   // Increased from 0.95 for smoother rolling
  const MIN_SPEED = 0.2;
  const RESET_DELAY = 1500;
  const INITIAL_ROTATION_SPEED = 15;
  const BALL_RADIUS = 15;
  const RIM_WIDTH = 48;
  const RIM_Y = 180;
  const RIM_OFFSET = 50;  // Distance from right edge
  const ALLOWED_OFFSET = 15;

  // Handle touch/click events
  const handleTouchStart = (e) => {
    e.preventDefault();
    if (!isMoving && !holding) {
      setHolding(true);
      setPower(0);  // Reset power when starting to hold
    }
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    if (holding) {
      const powerFactor = power / 100;
      setCurrentVelocity({
        x: PERFECT_VELOCITY_X * powerFactor,
        y: PERFECT_VELOCITY_Y * powerFactor
      });
      setRotationSpeed(INITIAL_ROTATION_SPEED);  // Add initial rotation
      setHolding(false);
      setIsMoving(true);
      setTime(0);
      attemptInProgressRef.current = true;
      hitBackboardRef.current = false;  // Reset hitBackboard at start of shot
      setHitRim(false);  // Reset hitRim at start of shot
    }
  };

  // Combined keyboard and touch controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!isMoving && !holding) {
          setHolding(true);
          setPower(0);  // Reset power when starting to hold
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
        setRotationSpeed(INITIAL_ROTATION_SPEED);  // Add initial rotation
        setHolding(false);
        setIsMoving(true);
        setTime(0);
        attemptInProgressRef.current = true;
        hitBackboardRef.current = false;  // Reset hitBackboard at start of shot
        setHitRim(false);  // Reset hitRim at start of shot
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
          } else {
            // Show MISS! if the shot didn't score
            setShotLabel('MISS!');
            setTimeout(() => {
              setShotLabel('');
            }, 1000);
          }
          setAttempts(a => a + 1);
          attemptInProgressRef.current = false;
          scoredRef.current = false;
          hitBackboardRef.current = false;
        }
      }, RESET_DELAY);
    }
    return () => clearTimeout(resetTimer);
  }, [isMoving]);

  // Ball physics with collisions
  useEffect(() => {
    let frameId;
    
    const updatePosition = () => {
      if (isMoving && containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        setTime(t => t + 1);
        setRotation(r => r + rotationSpeed);
        setBallPos(pos => {
          const newPos = {
            x: pos.x + currentVelocity.x,
            y: pos.y + currentVelocity.y + (GRAVITY * time)
          };

          // Calculate rim positions based on container width
          const RIM_BACK = containerWidth - RIM_OFFSET;
          const RIM_FRONT = RIM_BACK - RIM_WIDTH;
          const SCORING_X = RIM_FRONT + (RIM_WIDTH * 0.6);  // Adjusted to match visual rim position

          // Ground collision with bounce
          if (newPos.y > 350) {
            newPos.y = 350;
            const speed = Math.sqrt(currentVelocity.x * currentVelocity.x + currentVelocity.y * currentVelocity.y);
            
            if (speed < MIN_SPEED) {
              setCurrentVelocity({ x: 0, y: 0 });
            } else {
              setCurrentVelocity(v => ({
                x: v.x * GROUND_FRICTION,
                y: -v.y * BOUNCE_DAMPING
              }));
              setRotationSpeed(rs => rs * GROUND_FRICTION);
            }
          }

          // Wall collisions
          if (newPos.x > containerWidth - 30) {
            newPos.x = containerWidth - 30;
            const impactForce = Math.abs(currentVelocity.x);
            const reverseSpeed = Math.max(8, impactForce * 0.8);  // Ensure minimum reverse speed
            setCurrentVelocity(v => ({
              x: -reverseSpeed,  // Set a fixed reverse speed based on impact
              y: v.y * 0.95 + (impactForce > 8 ? -3 : -1)  // Smaller upward force
            }));
            setRotationSpeed(rs => -rs * 1.2);  // Increased rotation on wall hits
            // Count as backboard hit if near rim height
            if (newPos.y > RIM_Y - 90 && newPos.y < RIM_Y + 90) {
              hitBackboardRef.current = true;
            }
          } else if (newPos.x < 30) {
            newPos.x = 30;
            const impactForce = Math.abs(currentVelocity.x);
            const reverseSpeed = Math.max(8, impactForce * 0.8);  // Ensure minimum reverse speed
            setCurrentVelocity(v => ({
              x: reverseSpeed,  // Set a fixed reverse speed based on impact
              y: v.y * 0.95 + (impactForce > 8 ? -3 : -1)  // Smaller upward force
            }));
            setRotationSpeed(rs => -rs * 1.2);  // Increased rotation on wall hits
          }

          // Rim collisions with improved physics
          if (newPos.y > RIM_Y - 20 && newPos.y < RIM_Y + 20) {
            // Ball hitting front of rim
            if (newPos.x + BALL_RADIUS > RIM_FRONT && newPos.x - BALL_RADIUS < RIM_FRONT && pos.x - BALL_RADIUS <= RIM_FRONT) {
              newPos.x = RIM_FRONT - BALL_RADIUS;
              setCurrentVelocity(v => ({
                x: -v.x * BOUNCE_DAMPING * 0.8,
                y: v.y * 0.95 - 1.5
              }));
              setHitRim(true);
            }
            // Ball hitting back of rim
            else if (newPos.x + BALL_RADIUS > RIM_BACK && newPos.x - BALL_RADIUS < RIM_BACK && pos.x + BALL_RADIUS >= RIM_BACK) {
              newPos.x = RIM_BACK + BALL_RADIUS;
              setCurrentVelocity(v => ({
                x: -v.x * BOUNCE_DAMPING * 0.8,
                y: v.y * 0.95 - 1.5
              }));
              setHitRim(true);
            }
          }

          // Score detection at the actual scoring position
          const isPassingDownThroughRim = pos.y <= RIM_Y && newPos.y >= RIM_Y;
          const isWithinRimXRange = newPos.x >= RIM_FRONT && newPos.x <= RIM_BACK + RIM_WIDTH;

          if (!scoredRef.current && isPassingDownThroughRim && isWithinRimXRange) {
            setScore(s => s + POINTS_PER_BASKET);
            scoredRef.current = true;
            
            // Set shot label based on how it went in
            if (!hitBackboardRef.current && !hitRim) {
              setShotLabel('SWISH!');
            } else if (hitBackboardRef.current && !hitRim) {
              setShotLabel('SCORE!');
            } else {
              setShotLabel('SCORE!');
            }
            
            setTimeout(() => {
              setShotLabel('');
            }, 1000);
          } 

          // Debug logging with relative positions
          if (Math.abs(newPos.y - RIM_Y) < 50) {
            console.log('Ball Position:', {
              yDistanceFromRim: (RIM_Y - newPos.y).toFixed(1),
              xPosition: newPos.x,
              rimFront: RIM_FRONT,
              rimBack: RIM_BACK,
              willScore: !scoredRef.current && isPassingDownThroughRim && isWithinRimXRange,
              hitBackboard: hitBackboardRef.current,
              hitRim,
              isPassingDown: isPassingDownThroughRim,
              isWithinRange: isWithinRimXRange
            });
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
    <div className="min-h-screen bg-white flex justify-center items-center select-none">
      <div 
        ref={containerRef}
        className="relative w-full max-w-[650px] h-[400px] sm:h-[400px] bg-gray-900 border-2 border-gray-700 touch-none select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
      >
        {/* Score and Accuracy */}
        <div className="absolute top-0 left-0 right-0 p-2 sm:p-4 flex justify-between items-start text-white select-none">
          <div className="flex flex-col select-none">
            <div className="text-xl sm:text-2xl font-bold">{score}</div>
            <div className="text-lg sm:text-xl">
              {makes} / {attempts} ({attempts > 0 ? Math.round((makes/attempts) * 100) : 0}%)
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 sm:gap-2 select-none">
            <div className="text-xs sm:text-sm text-center">
              {window.innerWidth <= 640 ? 'Tap and hold to shoot!' : 'Hold SPACEBAR to set power - More power = longer shot!'}
            </div>
            <div className="w-24 sm:w-32 h-4 sm:h-6 border-2 border-white bg-black">
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

        {/* Shot Label */}
        {shotLabel && (
          <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-3xl sm:text-4xl font-bold text-white z-10 select-none">
            {shotLabel}
          </div>
        )}

        {/* Ball */}
        <div
          className="absolute text-3xl sm:text-4xl transition-transform select-none"
          style={{
            left: `${ballPos.x}px`,
            top: `${ballPos.y}px`,
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`
          }}
        >
          🏀
        </div>

        {/* 3pt Line Indicator */}
        <div className="absolute text-white font-bold select-none" style={{ left: '150px', bottom: '10px' }}>
          |
          <br />
          3pts
        </div>

        {/* Floor */}
        <div className="absolute bottom-0 w-full h-1 bg-gray-700" />

        {/* Hoop */}
        <div className="absolute select-none" style={{ right: '50px', top: '180px' }}>
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