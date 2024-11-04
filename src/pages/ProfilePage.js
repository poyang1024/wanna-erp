import React, { useState, useEffect } from 'react';
import { Container, Header, Form, Button, Message, Grid, Segment, Icon } from 'semantic-ui-react';
import { useNavigate } from 'react-router-dom';
import firebase from '../utils/firebase';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    phoneNumber: ''
  });
  const [messages, setMessages] = useState({
    verificationSent: false,
    lastVerificationTime: null
  });

  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setFormData({
          displayName: currentUser.displayName || '',
          email: currentUser.email || '',
          phoneNumber: currentUser.phoneNumber || ''
        });
      } else {
        navigate('/signin');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleUpdateProfile = async () => {
    setUpdateLoading(true);
    try {
      await firebase.auth().currentUser.updateProfile({
        displayName: formData.displayName
      });
      
      setUser(firebase.auth().currentUser);
      setEditMode(false);
      toast.success('個人資料更新成功！');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('更新失敗：' + error.message);
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleSendVerificationEmail = async () => {
    try {
      const currentTime = new Date().getTime();
      const lastSentTime = messages.lastVerificationTime;
      
      // 檢查是否在 2 分鐘內已發送過驗證信
      if (lastSentTime && (currentTime - lastSentTime) < 120000) {
        toast.warning('請等待 2 分鐘後再重新發送驗證信');
        return;
      }

      await firebase.auth().currentUser.sendEmailVerification();
      setMessages({
        verificationSent: true,
        lastVerificationTime: currentTime
      });
      toast.success('驗證信已發送，請查收您的信箱');
    } catch (error) {
      console.error('Error sending verification email:', error);
      toast.error('發送驗證信失敗：' + error.message);
    }
  };

  const handleSendPasswordReset = async () => {
    setResetLoading(true);
    try {
      await firebase.auth().sendPasswordResetEmail(user.email);
      toast.success('密碼重設信已發送到您的信箱');
    } catch (error) {
      console.error('Error sending password reset:', error);
      toast.error('發送密碼重設信失敗：' + error.message);
    } finally {
      setResetLoading(false);
    }
  };

  if (loading) {
    return <Container text><Message>載入中...</Message></Container>;
  }

  return (
    <Container>
      <ToastContainer />
      <Header as="h2" icon textAlign="center">
        <Icon name="user circle" />
        會員資料
      </Header>

      <Grid centered>
        <Grid.Column width={12}>
          <Segment padded>
            <Form>
              <Form.Field>
                <label>電子信箱</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input value={user.email} readOnly style={{ flex: 1 }} />
                  {!user.emailVerified && (
                    <Button
                      color="yellow"
                      onClick={handleSendVerificationEmail}
                      disabled={messages.verificationSent}
                    >
                      發送驗證信
                    </Button>
                  )}
                </div>
                {user.emailVerified ? (
                  <Message positive>
                    <Icon name="check circle" />
                    信箱已驗證
                  </Message>
                ) : (
                  <Message warning>
                    <Icon name="warning circle" />
                    信箱尚未驗證
                  </Message>
                )}
              </Form.Field>

              <Form.Field>
                <label>顯示名稱</label>
                {editMode ? (
                  <Form.Input
                    fluid
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="請輸入顯示名稱"
                  />
                ) : (
                  <input value={formData.displayName || '尚未設定'} readOnly />
                )}
              </Form.Field>

              <Form.Field>
                <label>註冊時間</label>
                <input 
                  value={user.metadata.creationTime} 
                  readOnly 
                />
              </Form.Field>

              <Form.Field>
                <label>最後登入時間</label>
                <input 
                  value={user.metadata.lastSignInTime} 
                  readOnly 
                />
              </Form.Field>

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                {editMode ? (
                  <>
                    <Button
                      positive
                      onClick={handleUpdateProfile}
                      loading={updateLoading}
                    >
                      儲存變更
                    </Button>
                    <Button
                      negative
                      onClick={() => {
                        setEditMode(false);
                        setFormData({
                          ...formData,
                          displayName: user.displayName || ''
                        });
                      }}
                    >
                      取消
                    </Button>
                  </>
                ) : (
                  <Button
                    primary
                    onClick={() => setEditMode(true)}
                  >
                    編輯資料
                  </Button>
                )}
                <Button
                  color="orange"
                  onClick={handleSendPasswordReset}
                  loading={resetLoading}
                >
                  重設密碼
                </Button>
              </div>
            </Form>
          </Segment>
        </Grid.Column>
      </Grid>
    </Container>
  );
}

export default ProfilePage;