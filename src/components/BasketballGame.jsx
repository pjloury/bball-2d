import React, { useState, useEffect, useRef } from 'react';
import bigWestLogo from '../assets/big-west.png';
import ucsdFacts from '../data/ucsdFacts.json';
import ucsdLogo from '../assets/ucsandiego.png';
import firstRound from '../assets/first-round.jpg';
import nextStopLogo from '../assets/next-stop.png';
import marchMadnessLogo from '../assets/march-madness.png';

const BasketballGame = () => {
  const [ballPos, setBallPos] = useState({ x: window.innerWidth <= 640 ? 60 : 100, y: 350 });
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
  const PERFECT_VELOCITY_X = 6.5;    // Reduced for more controlled horizontal movement
  const PERFECT_VELOCITY_Y = -13;    // Adjusted for optimal arc
  const GRAVITY = 0.45;              // Fine-tuned gravity
  const POWER_RATE = 1.6;           // Doubled from 0.8 for faster power meter movement
  const POINTS_PER_BASKET = 3;
  const BOUNCE_DAMPING = 0.8;       // Increased to preserve more vertical energy
  const GROUND_FRICTION = 0.95;     // Keep same ground friction
  const MIN_SPEED = 0.2;
  const RESET_DELAY = 1500;
  const INITIAL_ROTATION_SPEED = 15;
  const ROTATION_DAMPING = 0.85;      // Added to gradually reduce rotation
  const MAX_ROTATION_SPEED = 20;      // Added to cap maximum rotation speed
  const BALL_RADIUS = 15;
  const RIM_WIDTH = 48;
  const RIM_Y = 180;
  const RIM_OFFSET = 50;  // Distance from right edge
  const ALLOWED_OFFSET = 15;
  const SWEET_SPOT_MIN = 45;  // Sweet spot range for power meter
  const SWEET_SPOT_MAX = 55;

  // Update game constants
  const POWER_MIN_FACTOR = 0.7;  // Minimum power factor (70% of perfect velocity)
  const POWER_MAX_FACTOR = 1.3;  // Maximum power factor (130% of perfect velocity)
  
  // Adjust sweet spot velocity modifiers
  const SWEET_SPOT_VELOCITY_MODIFIER = {
    x: 1.0,    // Perfect horizontal velocity in sweet spot
    y: 1.0,    // Perfect vertical velocity in sweet spot
    margin: 0.15  // Maximum deviation within sweet spot (15%)
  };

  // Helper to get power factor with better scaling
  const getPowerFactor = (powerValue) => {
    return POWER_MIN_FACTOR + (POWER_MAX_FACTOR - POWER_MIN_FACTOR) * (powerValue / 100);
  };

  // Calculate perfect velocities based on viewport
  const calculatePerfectVelocities = (containerWidth) => {
    // Target position (rim)
    const targetX = containerWidth - RIM_OFFSET - (RIM_WIDTH / 2);
    const targetY = RIM_Y;
    
    // Starting position
    const startX = 100;  // Initial ball X position
    const startY = 350;  // Initial ball Y position
    
    // Calculate distance to target
    const dx = targetX - startX;
    const dy = targetY - startY;
    
    // Time to reach target (experimentally determined for smooth arc)
    const timeToTarget = Math.sqrt(dx / 400) * 45;
    
    // Calculate required velocities using projectile motion equations
    const velocityX = dx / timeToTarget;
    
    // Adjust vertical velocity for mobile screens
    const isMobile = window.innerWidth <= 640;
    const mobileAdjustment = isMobile ? 1.15 : 1.0; // Increase upward velocity by 15% on mobile
    const velocityY = (dy - (0.5 * GRAVITY * timeToTarget * timeToTarget)) / timeToTarget * mobileAdjustment;
    
    return { velocityX, velocityY };
  };

  // Update shot physics calculation
  const calculateShotVelocity = (powerValue, containerWidth) => {
    const { velocityX, velocityY } = calculatePerfectVelocities(containerWidth);
    
    const sweetSpotCenter = (SWEET_SPOT_MIN + SWEET_SPOT_MAX) / 2;
    const distanceFromPerfect = Math.abs(powerValue - sweetSpotCenter);
    const isMobile = window.innerWidth <= 640;
    
    if (isMobile) {
      // Mobile-specific logic with more challenging shots
      let velocityModifier;
      if (powerValue >= SWEET_SPOT_MIN && powerValue <= SWEET_SPOT_MAX) {
        const sweetSpotProgress = distanceFromPerfect / (SWEET_SPOT_MAX - sweetSpotCenter);
        const randomVariation = (Math.random() * 2 - 1) * 0.05;
        velocityModifier = 1 + (randomVariation * sweetSpotProgress);
      } else {
        const powerDiff = powerValue - sweetSpotCenter;
        const missScale = Math.abs(powerDiff) / 50;
        
        if (powerValue < SWEET_SPOT_MIN) {
          const shortRandomness = Math.random() * 0.1;
          return {
            x: velocityX * (0.85 - missScale * 0.15 + shortRandomness),
            y: velocityY * (0.85 - missScale * 0.15 + shortRandomness)
          };
        } else {
          const longRandomness = Math.random() * 0.1;
          return {
            x: velocityX * (1.15 + missScale * 0.15 + longRandomness),
            y: velocityY * (1.15 + missScale * 0.15 + longRandomness)
          };
        }
      }
      return {
        x: velocityX * velocityModifier,
        y: velocityY * velocityModifier
      };
    } else {
      // Desktop-specific logic with more forgiving shots
      let velocityModifier;
      if (powerValue >= SWEET_SPOT_MIN && powerValue <= SWEET_SPOT_MAX) {
        const sweetSpotProgress = distanceFromPerfect / (SWEET_SPOT_MAX - sweetSpotCenter);
        const randomVariation = (Math.random() * 2 - 1) * 0.02;
        velocityModifier = 1 + (randomVariation * sweetSpotProgress);
      } else {
        const powerDiff = powerValue - sweetSpotCenter;
        const missScale = Math.abs(powerDiff) / 50;
        
        if (powerValue < SWEET_SPOT_MIN) {
          const shortRandomness = Math.random() * 0.05;
          return {
            x: velocityX * (0.95 - missScale * 0.05 + shortRandomness),
            y: velocityY * (0.95 - missScale * 0.05 + shortRandomness)
          };
        } else {
          const longRandomness = Math.random() * 0.05;
          return {
            x: velocityX * (1.05 + missScale * 0.05 + longRandomness),
            y: velocityY * (1.05 + missScale * 0.05 + longRandomness)
          };
        }
      }
      return {
        x: velocityX * velocityModifier,
        y: velocityY * velocityModifier
      };
    }
  };

  // Update viewport scaling helper
  const getViewportAdjustedVelocity = (baseVelocity, containerWidth) => {
    const standardWidth = 650;
    const scaleFactor = Math.sqrt(containerWidth / standardWidth);
    return baseVelocity * scaleFactor;
  };

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
    if (holding && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const velocity = calculateShotVelocity(power, containerWidth);
      
      setCurrentVelocity(velocity);
      setRotationSpeed(INITIAL_ROTATION_SPEED);
      setHolding(false);
      setIsMoving(true);
      setTime(0);
      attemptInProgressRef.current = true;
      hitBackboardRef.current = false;
      setHitRim(false);
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
      if (e.code === 'Space' && holding && containerRef.current) {
        e.preventDefault();
        const containerWidth = containerRef.current.clientWidth;
        const velocity = calculateShotVelocity(power, containerWidth);
        
        setCurrentVelocity(velocity);
        setRotationSpeed(INITIAL_ROTATION_SPEED);
        setHolding(false);
        setIsMoving(true);
        setTime(0);
        attemptInProgressRef.current = true;
        hitBackboardRef.current = false;
        setHitRim(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isMoving, holding, power]);

  // Add state for tracking oscillation time
  const [oscillationTime, setOscillationTime] = useState(0);

  // Add state for tracking oscillation direction
  const [powerIncreasing, setPowerIncreasing] = useState(true);

  // Update power meter oscillation
  useEffect(() => {
    let powerInterval;
    let lastTime = null;
    const targetFrameRate = 60;
    const msPerFrame = 1000 / targetFrameRate;
    
    const updatePower = (timestamp) => {
      if (!lastTime) lastTime = timestamp;
      const deltaTime = timestamp - lastTime;
      
      if (deltaTime >= msPerFrame) {
        setPower(prev => {
          const newPower = prev + (powerIncreasing ? POWER_RATE : -POWER_RATE);
          
          // Change direction at bounds
          if (newPower >= 100) {
            setPowerIncreasing(false);
            return 100;
          } else if (newPower <= 0) {
            setPowerIncreasing(true);
            return 0;
          }
          return newPower;
        });
        lastTime = timestamp;
      }
      
      if (holding && !isMoving) {
        powerInterval = requestAnimationFrame(updatePower);
      }
    };

    if (holding && !isMoving) {
      powerInterval = requestAnimationFrame(updatePower);
    } else if (!holding) {
      setPower(0);
      setPowerIncreasing(true);  // Reset direction when released
    }

    return () => {
      if (powerInterval) {
        cancelAnimationFrame(powerInterval);
      }
    };
  }, [holding, isMoving, powerIncreasing]);

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

  // Update bounce physics constants
  const MIN_BOUNCE_SPEED = 2;       // Increased minimum speed for bouncing
  const BOUNCE_THRESHOLD = 350;     // Keep same ground position
  const INITIAL_BOUNCE_BOOST = 1.1; // Slightly reduced boost factor

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
          const SCORING_MARGIN = 10; // Add some margin for scoring detection

          // Improved ground collision with better vertical bouncing
          if (newPos.y > BOUNCE_THRESHOLD) {
            newPos.y = BOUNCE_THRESHOLD;
            const verticalSpeed = Math.abs(currentVelocity.y);
            
            if (verticalSpeed < MIN_BOUNCE_SPEED) {
              // Ball is moving too slowly to bounce, just roll
              setCurrentVelocity(v => ({
                x: v.x * GROUND_FRICTION,
                y: 0
              }));
              // Gradually reduce rotation when rolling
              setRotationSpeed(rs => {
                const newSpeed = rs * GROUND_FRICTION * 0.95;
                return Math.abs(newSpeed) < 0.5 ? 0 : newSpeed;
              });
            } else {
              // Enhanced bounce physics with better vertical preservation
              const bounceVelocity = verticalSpeed * BOUNCE_DAMPING;
              
              setCurrentVelocity(v => ({
                x: v.x * GROUND_FRICTION,
                y: -bounceVelocity
              }));
              
              // More realistic rotation on bounce
              setRotationSpeed(rs => {
                const newSpeed = rs * ROTATION_DAMPING + (Math.abs(currentVelocity.x) * 0.2);
                return Math.min(Math.max(-MAX_ROTATION_SPEED, newSpeed), MAX_ROTATION_SPEED);
              });
            }
          }

          // Wall collisions with more realistic bounces
          if (newPos.x > containerWidth - 30) {
            newPos.x = containerWidth - 30;
            const impactForce = Math.abs(currentVelocity.x);
            setCurrentVelocity(v => ({
              x: -impactForce * 0.5,  // Reduced bounce force
              y: v.y * 0.9            // Reduce vertical velocity on impact
            }));
            setRotationSpeed(rs => -rs * 0.8);  // Reduced rotation on wall hits
            
            // Count as backboard hit if near rim height
            if (newPos.y > RIM_Y - 90 && newPos.y < RIM_Y + 90) {
              hitBackboardRef.current = true;
            }
          } else if (newPos.x < 30) {
            newPos.x = 30;
            const impactForce = Math.abs(currentVelocity.x);
            setCurrentVelocity(v => ({
              x: impactForce * 0.5,   // Reduced bounce force
              y: v.y * 0.9            // Reduce vertical velocity on impact
            }));
            setRotationSpeed(rs => -rs * 0.8);  // Reduced rotation on wall hits
          }

          // Rim collisions with improved physics and better detection
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
              setShotLabel('SWISH! 🔱');
            } else if (hitBackboardRef.current && !hitRim) {
              setShotLabel('OFF THE GLASS! 🔱');
            } else {
              setShotLabel('SCORE! 🔱');
            }
            
            // Check if this is the third basket
            if (makes + 1 === 3) {
              setTimeout(() => {
                setShowSharePopup(true);
              }, 500);
            }
            
            setTimeout(() => {
              setShotLabel('');
            }, 1000);
          }

          // Debug logging
          if (Math.abs(newPos.y - RIM_Y) < 50) {
            console.log('Ball Position:', {
              yDistanceFromRim: (RIM_Y - newPos.y).toFixed(1),
              xPosition: newPos.x,
              rimFront: RIM_FRONT,
              rimBack: RIM_BACK,
              ballVelocityY: currentVelocity.y,
              isPassingThrough: isPassingDownThroughRim,
              isWithinRange: isWithinRimXRange,
              willScore: !scoredRef.current && isPassingDownThroughRim && isWithinRimXRange
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

  // Update the power meter color calculation
  const getPowerMeterColor = (powerValue) => {
    const sweetSpotCenter = (SWEET_SPOT_MIN + SWEET_SPOT_MAX) / 2;
    const sweetSpotRange = (SWEET_SPOT_MAX - SWEET_SPOT_MIN) / 2;
    
    // Calculate distance from sweet spot center
    const distanceFromCenter = Math.abs(powerValue - sweetSpotCenter);
    
    if (distanceFromCenter <= sweetSpotRange) {
      return '#22c55e'; // green-500 for sweet spot
    } else if (powerValue < sweetSpotCenter) {
      return '#fbbf24'; // yellow-400 for too weak
    } else {
      return '#ef4444'; // red-500 for too strong
    }
  };

  // Add state for the current fact
  const [currentFact, setCurrentFact] = useState('');

  // Add useEffect to set initial random fact
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * ucsdFacts.facts.length);
    setCurrentFact(ucsdFacts.facts[randomIndex]);
  }, []);

  // Add UCSD brand colors as constants
  const UCSD_COLORS = {
    navy: '#182B49',    // UCSD Navy Blue
    gold: '#FFCD00',    // UCSD Gold
  };

  // Add state for overlay
  const [showOverlay, setShowOverlay] = useState(true);
  const [showSharePopup, setShowSharePopup] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // Add auto-dismiss timer
  useEffect(() => {
    if (showOverlay) {
      const timer = setTimeout(() => {
        setShowOverlay(false);
      }, 4000);  // 4 seconds

      // Cleanup timer if component unmounts or overlay is manually dismissed
      return () => clearTimeout(timer);
    }
  }, [showOverlay]);

  // Add state for fade animation
  const [fadeOut, setFadeOut] = useState(false);

  // Modify the fact change handler
  const handleNewFact = () => {
    setFadeOut(true);
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * ucsdFacts.facts.length);
      setCurrentFact(ucsdFacts.facts[randomIndex]);
      setFadeOut(false);
    }, 300); // Match this with CSS transition duration
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center select-none">
      {/* Overlay */}
      {showOverlay && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowOverlay(false)}
        >
          <div 
            className="bg-white p-2 sm:p-8 rounded-lg flex flex-col items-center gap-4 sm:gap-6 m-2 sm:m-4 w-[95%] sm:w-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full bg-black rounded-lg">
              <img 
                src={firstRound}
                alt="UCSD March Madness Round 1 Matchups"
                className="w-full h-auto object-contain max-h-[80vh]"
              />
            </div>
            <button 
              onClick={() => setShowOverlay(false)}
              className="bg-[#FFCD00] px-6 py-2 text-xl font-bold text-[#182B49] hover:bg-[#182B49] hover:text-[#FFCD00] transition-all border-2 border-[#182B49] hover:border-[#FFCD00]"
            >
              Let's Play! 🏀
            </button>
          </div>
        </div>
      )}

      {/* Share Popup */}
      {showSharePopup && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowSharePopup(false)}
        >
          <div 
            className="bg-white p-8 rounded-lg flex flex-col items-center gap-6 m-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-[#182B49] text-center">
              Pass it on! 🏀 Share with a fellow Triton 🔱
            </h2>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href).then(() => {
                  setShowToast(true);
                  setTimeout(() => {
                    setShowSharePopup(false);
                  }, 500);
                  setTimeout(() => {
                    setShowToast(false);
                  }, 2000);
                });
              }}
              className="bg-[#FFCD00] px-6 py-2 text-xl font-bold text-[#182B49] hover:bg-[#182B49] hover:text-[#FFCD00] transition-all border-2 border-[#182B49] hover:border-[#FFCD00]"
            >
              Copy Link
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-[#182B49] text-[#FFCD00] px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity duration-300">
          Link copied! 🔱
        </div>
      )}

           {/* Title with UCSD colors */}
      <h1 className="text-2xl sm:text-4xl font-bold text-[#182B49] mb-2 sm:mb-8 mt-2 sm:mt-4">
        UCSD's first March Madness! 🔱
      </h1>

      {/* Championship Links */}
      <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 mt-1 sm:mt-2 mb-6">
        <a 
          href="https://ucsdtritons.com/news/2025/3/15/womens-basketball-champions-tritons-earn-first-big-west-tournament-crown.aspx"
          target="_blank"
          rel="noopener noreferrer"
          className="text-lg font-bold text-[#182B49] hover:text-[#FFCD00] transition-colors text-center"
        >
          <div>Big West Women's Champions 🏆</div>
          <div className="text-base font-medium text-gray-600">UCSD 75, UC Davis 66</div>
        </a>
        <span className="hidden sm:inline text-[#182B49]">|</span>
        <a 
          href="https://ucsdtritons.com/news/2025/3/15/mens-basketball-tritons-down-irvine-to-win-first-big-west-championship.aspx"
          target="_blank"
          rel="noopener noreferrer"
          className="text-lg font-bold text-[#182B49] hover:text-[#FFCD00] transition-colors text-center"
        >
          <div>Big West Men's Champions 🏆</div>
          <div className="text-base font-medium text-gray-600">UCSD 75, UC Irvine 61</div>
        </a>
      </div>

 

      {/* Game Container with navy border */}
      <div 
        ref={containerRef}
        className="relative w-full max-w-[650px] h-[400px] bg-gray-900 border-2 border-[#182B49] touch-none select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
      >
        {/* Score display with mixed colors */}
        <div className="absolute top-0 left-0 right-0 p-2 sm:p-4 flex justify-between items-start select-none">
          <div className="flex flex-col select-none">
            <div className="text-lg sm:text-2xl font-bold text-[#FFCD00]">{score}</div>
            <div className="text-base sm:text-xl text-white">
              {makes} / {attempts} ({attempts > 0 ? Math.round((makes/attempts) * 100) : 0}%)
            </div>
          </div>

          {/* Power meter with UCSD colors */}
          <div className="flex flex-col items-end gap-1 sm:gap-2 select-none">
            <div className="text-xs sm:text-sm text-center text-white">
              {window.innerWidth <= 640 ? 
                'Tap and hold to set power' : 
                <>
                  Hold <span className="text-[#FFCD00]">SPACEBAR</span> or tap screen to set power
                </>
              }
            </div>
            <div className="relative w-24 sm:w-32 h-4 sm:h-6 border-2 border-white bg-black">
              {/* Sweet spot indicators */}
              <div 
                className="absolute h-full w-0.5 bg-white opacity-30" 
                style={{ left: `${SWEET_SPOT_MIN}%` }}
              />
              <div 
                className="absolute h-full w-0.5 bg-white opacity-50" 
                style={{ left: `${(SWEET_SPOT_MIN + SWEET_SPOT_MAX) / 2}%` }}
              />
              <div 
                className="absolute h-full w-0.5 bg-white opacity-30" 
                style={{ left: `${SWEET_SPOT_MAX}%` }}
              />
              {/* Power meter fill */}
              <div
                className="h-full transition-all duration-75"
                style={{ 
                  width: `${power}%`,
                  backgroundColor: getPowerMeterColor(power)
                }}
              />
            </div>
          </div>
        </div>

        {/* Shot label in white */}
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
        <div className="absolute text-white font-bold select-none" style={{ left: window.innerWidth <= 640 ? '120px' : '160px', bottom: '10px' }}>
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

      {/* UCSD Caption and Fact */}
      <div className="text-center">
        <h2 className="text-xl sm:text-2xl font-semibold text-[#182B49] mt-4">
          Did you know?
        </h2>
        <div className="h-[100px] flex items-center justify-center mb-2">
          <p className={`text-base sm:text-xl text-[#182B49] transition-opacity duration-300 px-12 max-w-[600px] ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
            <span className="italic">
              {currentFact.slice(0, currentFact.lastIndexOf(' '))}
            </span>
            <span>
              {' ' + currentFact.slice(currentFact.lastIndexOf(' ') + 1)}
            </span>
          </p>
        </div>
        <div className="flex justify-center gap-4 mb-8 px-4">
          <button
            onClick={handleNewFact}
            className="bg-[#182B49] px-6 py-2 text-[#FFCD00] active:bg-[#FFCD00] active:text-[#182B49] transition-all border-2 border-[#FFCD00] active:border-[#182B49] text-lg font-semibold"
          >
            Give me another fact! 🏀
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href).then(() => {
                setShowToast(true);
                setTimeout(() => {
                  setShowSharePopup(false);
                }, 500);
                setTimeout(() => {
                  setShowToast(false);
                }, 2000);
              });
            }}
            className="bg-[#182B49] px-6 py-2 text-[#FFCD00] active:bg-[#FFCD00] active:text-[#182B49] transition-all border-2 border-[#FFCD00] active:border-[#182B49] text-lg font-semibold"
          >
            Share with a Triton 🔱
          </button>
        </div>
      </div>

      {/* Big West Logo and Upcoming Games Container */}
      <div className="mt-auto mb-8 w-full max-w-[900px] flex flex-col sm:flex-row items-stretch justify-center px-8">
        {/* March Madness Logo */}
        <a 
          href="https://www.ncaa.com/news/basketball-men/article/2025-03-16/2025-march-madness-mens-ncaa-tournament-schedule-dates"
          target="_blank"
          rel="noopener noreferrer"
          className="border-b-4 border-transparent hover:border-[#FFCD00] transition-colors sm:w-[37.5%] flex items-start"
        >
          <img 
            src={marchMadnessLogo}
            alt="March Madness"
            className="w-full object-contain"
          />
        </a>

        {/* Upcoming Games */}
        <div className="flex flex-col sm:w-[62.5%]">
          <div className="px-8">
            <div className="flex flex-col gap-4">
              <h4 className="text-3xl font-bold text-[#182B49] tracking-wide">March 19</h4>
              <div className="flex flex-col gap-1">
                <span className="text-xl font-bold text-[#182B49]">Women's First Four</span>
                <span className="text-lg text-gray-600">#16 UCSD vs. #16 Southern University</span>
                <span className="text-base font-medium text-[#182B49]">6 PM PT, <span className="text-[#00A3E0]">ESPN+</span></span>
              </div>
              <h4 className="text-3xl font-bold text-[#182B49] tracking-wide">March 20</h4>
              <div className="flex flex-col gap-1">
                <span className="text-xl font-bold text-[#182B49]">Men's First Round</span>
                <span className="text-lg text-gray-600">#12 UCSD vs. #5 Michigan</span>
                <span className="text-base font-medium text-[#182B49]">7 PM PT, <span className="text-red-600">TBS</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* News Links and UCSD Logo */}
      <div className="mt-8 flex flex-col items-center">
        <div className="text-center max-w-[600px] px-4 mb-4">
          <span className="text-lg text-gray-700">
            UC San Diego featured in 📰
          </span>
          <div className="flex flex-wrap justify-center gap-x-2 mt-1">
            <a 
              href="https://www.cbssports.com/college-basketball/news/finally-eligible-for-march-madness-division-is-most-unlikely-success-story-out-to-prove-its-not-done-yet/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg text-blue-600 hover:text-blue-800 hover:underline"
            >
              CBS Sports
            </a>
            <span className="text-lg text-gray-700">|</span>
            <a 
              href="https://www.nytimes.com/athletic/6192140/2025/03/11/uc-san-diego-ncaa-tournament-eric-olen/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg text-blue-600 hover:text-blue-800 hover:underline"
            >
              NY Times
            </a>
            <span className="text-lg text-gray-700">|</span>
            <a 
              href="https://www.wsj.com/sports/basketball/march-madness-2025-ncaa-tournament-upset-picks-4c31c061"
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg text-blue-600 hover:text-blue-800 hover:underline"
            >
              WSJ Sports
            </a>
          </div>
        </div>
        <a 
          href="https://ucsdtritons.com/sports/mens-basketball"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 mb-4 border-b-4 border-transparent hover:border-[#FFCD00] transition-colors block"
        >
          <img 
            src={ucsdLogo}
            alt="UC San Diego"
            className="w-full max-w-[200px] px-4"
          />
        </a>
      </div>
    </div>
  );
};

export default BasketballGame;
