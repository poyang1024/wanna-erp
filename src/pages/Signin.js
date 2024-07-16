import React, { useState } from 'react';
import { Form, Container, Button } from 'semantic-ui-react';
import { useNavigate } from 'react-router-dom';
import firebase from '../utils/firebase';
import 'firebase/compat/auth';
import { toast } from 'react-toastify';

function Signin() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    async function onSubmit(e) {
        e.preventDefault();
        setIsLoading(true);
        try {
            // 使用 firebase 進行登入
            await firebase.auth().signInWithEmailAndPassword(email, password);
            
            // 設置最後活動時間（這仍然是必要的，因為它初始化了活動時間）
            localStorage.setItem('lastActivity', Date.now().toString());
            
            toast.success('登入成功！', {
                position: "top-center",
                autoClose: 1000,
            });
            
            // 登入成功後導航到主頁面
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