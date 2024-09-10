import React, { useState, useEffect } from 'react';
import { Form, Container, Button } from 'semantic-ui-react';
import { useNavigate } from 'react-router-dom';
import firebase from '../utils/firebase';
import 'firebase/compat/auth';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function Signin() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let inactivityTimer;
        let tokenRefreshInterval;

        const resetInactivityTimer = () => {
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(handleInactivity, 2 * 60 * 60 * 1000); // 2小時無活動自動登出
        };

        const handleInactivity = () => {
            firebase.auth().signOut().then(() => {
                toast.info('由於長時間無活動，您已被登出', {
                    position: "top-center",
                    autoClose: 3000,
                });
                navigate('/signin');
            });
        };

        const refreshToken = async () => {
            const user = firebase.auth().currentUser;
            if (user) {
                try {
                    await user.getIdToken(true);
                    console.log('Token refreshed');
                } catch (error) {
                    console.error('Failed to refresh token:', error);
                }
            }
        };

        const setupTokenRefresh = () => {
            tokenRefreshInterval = setInterval(refreshToken, 55 * 60 * 1000); // 每55分鐘刷新一次token
        };

        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                resetInactivityTimer();
                setupTokenRefresh();

                // 添加活動監聽器
                ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
                    document.addEventListener(event, resetInactivityTimer);
                });
            } else {
                clearTimeout(inactivityTimer);
                clearInterval(tokenRefreshInterval);
            }
        });

        return () => {
            unsubscribe();
            clearTimeout(inactivityTimer);
            clearInterval(tokenRefreshInterval);
            ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
                document.removeEventListener(event, resetInactivityTimer);
            });
        };
    }, [navigate]);

    async function onSubmit(e) {
        e.preventDefault();
        setIsLoading(true);
        try {
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            await firebase.auth().signInWithEmailAndPassword(email, password);
            
            toast.success('登入成功！', {
                position: "top-center",
                autoClose: 1000,
            });
            
            setTimeout(() => {
                navigate('/');
            }, 1500);
        } catch (error) {
            console.log(error.code)
            switch (error.code) {
                case 'auth/invalid-email':
                    toast.error('信箱格式錯誤');
                    break;
                case 'auth/user-not-found':
                    toast.error('此信箱尚未註冊');
                    break;
                case 'auth/wrong-password':
                    toast.error('密碼錯誤');
                    break;
                case 'auth/invalid-credential':
                    toast.error('信箱或密碼錯誤');
                    break;
                default:
                    toast.error('登入失敗，請稍後再試');
            }
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Container>
            <ToastContainer 
                position="top-center"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
            />
            <Form onSubmit={onSubmit}>
                <Form.Input
                    label="信箱"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="請輸入信箱">
                </Form.Input>
                <Form.Input
                    label="密碼"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="請輸入密碼"
                    type="password">
                </Form.Input>
                <Button primary loading={isLoading} type="submit">
                    登入
                </Button>
            </Form>
        </Container>
    );
}

export default Signin;