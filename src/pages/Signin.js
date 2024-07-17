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
        const checkLoginStatus = () => {
            const lastLogoutTime = localStorage.getItem('lastLogoutTime');
            const currentTime = new Date().getTime();
            
            if (lastLogoutTime && currentTime - parseInt(lastLogoutTime) <= 30000) {
                // 如果在30秒內重新打開頁面，嘗試恢復登入狀態
                firebase.auth().onAuthStateChanged((user) => {
                    if (user) {
                        navigate('/bom-table');
                    }
                });
            } else if (lastLogoutTime) {
                // 如果超過30秒，確保用戶已登出
                firebase.auth().signOut();
                localStorage.removeItem('lastLogoutTime');
            }
        };

        checkLoginStatus();

        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                user.getIdToken(true).then(() => {
                    setTimeout(() => {
                        firebase.auth().signOut().then(() => {
                            localStorage.setItem('lastLogoutTime', new Date().getTime().toString());
                            toast.info('登入已過期，請重新登入', {
                                position: "top-center",
                                autoClose: 3000,
                            });
                            navigate('/signin');
                        });
                    }, 10 * 60 * 1000); // 10 分鐘後登出
                });
            }
        });

        return () => unsubscribe();
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