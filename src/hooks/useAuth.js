
import { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import firebase from '../utils/firebase';  // 修正了路徑
import { toast } from 'react-toastify';

function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        const timestamp = Date.now();
        localStorage.setItem('lastActivityTime', timestamp.toString());
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 60 minutes
    const CHECK_INTERVAL = 60 * 1000; // 1 minute

    let timeoutId = null;
    let checkIntervalId = null;

    const updateLastActivity = () => {
      localStorage.setItem('lastActivityTime', Date.now().toString());
    };

    const resetInactivityTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      updateLastActivity();

      timeoutId = setTimeout(async () => {
        try {
          await firebase.auth().signOut();
          localStorage.removeItem('lastActivityTime');
          toast.info('由於長時間無活動，您已被登出', {
            position: "top-center",
            autoClose: 3000,
          });
          navigate('/signin');
        } catch (error) {
          console.error('Logout error:', error);
        }
      }, INACTIVITY_TIMEOUT);
    };

    // 定期檢查最後活動時間
    const startPeriodicCheck = () => {
      checkIntervalId = setInterval(() => {
        const lastActivity = parseInt(localStorage.getItem('lastActivityTime') || '0');
        const currentTime = Date.now();

        if (currentTime - lastActivity >= INACTIVITY_TIMEOUT) {
          firebase.auth().signOut().then(() => {
            localStorage.removeItem('lastActivityTime');
            clearInterval(checkIntervalId);
            toast.info('由於長時間無活動，您已被登出', {
              position: "top-center",
              autoClose: 3000,
            });
            navigate('/signin');
          });
        }
      }, CHECK_INTERVAL);
    };

    // 初始化定時器
    resetInactivityTimer();
    startPeriodicCheck();

    // 節流函數
    let throttleTimeout;
    const throttledResetTimer = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          resetInactivityTimer();
          throttleTimeout = null;
        }, 1000);
      }
    };

    // 監聽用戶活動事件
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'input',
      'change',
      'submit',
      'focus',
      'blur'
    ];

    activityEvents.forEach(event => {
      window.addEventListener(event, throttledResetTimer);
    });

    // 清理函數
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (checkIntervalId) {
        clearInterval(checkIntervalId);
      }
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
      activityEvents.forEach(event => {
        window.removeEventListener(event, throttledResetTimer);
      });
    };
  }, [navigate, user]);

  return { user, loading };
}

export default useAuth;