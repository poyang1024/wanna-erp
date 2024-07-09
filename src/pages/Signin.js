import { Form, Container, Button } from 'semantic-ui-react';
import { useNavigate } from 'react-router-dom';
import React from 'react';
import firebase from '../utils/firebase';
import 'firebase/compat/auth';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function Signin() {
    const navigate = useNavigate();
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);

    function onSubmit() {
        setIsLoading(true);
        firebase.auth().signInWithEmailAndPassword(email, password)
            .then(() => {
                toast.success('登入成功！', {
                    position: "top-center",
                    autoClose: 1000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                });
                setTimeout(() => {
                    navigate('/bom-table');
                }, 2000);
            })
            .catch((error) => {
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
            })
            .finally(() => {
                setIsLoading(false);
            });
    }

    return (
        <Container>
            <ToastContainer 
                position="top-center"
                autoClose={1000}
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
                <Button primary loading={isLoading}>
                    登入
                </Button>
            </Form>
        </Container>
    );
}

export default Signin;