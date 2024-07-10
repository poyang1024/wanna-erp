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
        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                // 當用戶登入狀態改變時，設置 token 過期時間
                user.getIdToken(true).then(() => {
                    setTimeout(() => {
                        firebase.auth().signOut().then(() => {
                            toast.info('登入已過期，請重新登入', {
                                position: "top-center",
                                autoClose: 3000,
                            });
                            navigate('/signin');
                        });
                    }, 5 * 60 * 1000); // 5 分鐘後登出
                });
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    async function onSubmit(e) {
        e.preventDefault();
        setIsLoading(true);
        try {
            // 設置會話持久性為 'session'，這樣瀏覽器關閉後就會登出
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);
            await firebase.auth().signInWithEmailAndPassword(email, password);
            
            toast.success('登入成功！', {
                position: "top-center",
                autoClose: 1000,
            });
            
            setTimeout(() => {
                navigate('/bom-table');
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