import React, { useState, useEffect, useRef } from 'react';
import { Menu, Search, Dimmer, Loader, Dropdown } from 'semantic-ui-react';
import { Link, useNavigate } from "react-router-dom";
import firebase from './utils/firebase';

function Header() {
    const [user, setUser] = useState(null);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();
    const timerRef = useRef(null);

    useEffect(() => {
        let isMounted = true;

        const unsubscribe = firebase.auth().onAuthStateChanged((currentUser) => {
            if (!isMounted) return;

            setIsLoading(true);

            if (currentUser) {
                timerRef.current = setTimeout(() => {
                    if (isMounted) {
                        setUser(currentUser);
                        setIsLoading(false);
                    }
                }, 1500);
            } else {
                setUser(null);
                setIsLoading(false);
                if (isLoggingOut) {
                    navigate("/");
                    setIsLoggingOut(false);
                }
            }
        });

        return () => {
            isMounted = false;
            unsubscribe();
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [navigate, isLoggingOut]);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await firebase.auth().signOut();
        } catch (error) {
            console.error("Logout error:", error);
            setIsLoggingOut(false);
        }
    };

    const styles = {
        dropdownButton: {
            backgroundColor: '#C4E1FF',
            color: '#000',
        },
        dropdownItem: {
            color: '#000',
        },
        pricingButton: {  // 改名為 pricingButton
            backgroundColor: '#81C0C0',
            color: '#000',
        },
        profileButton: {
            backgroundColor: '#FFAD86',
            color: '#000',
        },
        profileButtonHover: {
            backgroundColor: '#FFCBB3',
        },
    };

    const handleMouseEnter = (e, hoverStyle) => {
        Object.assign(e.target.style, hoverStyle);
    };

    const handleMouseLeave = (e, originalStyle) => {
        Object.assign(e.target.style, originalStyle);
    };

    if (isLoading) {
        return <Dimmer active><Loader>加載中...</Loader></Dimmer>;
    }

    return (
        <>
            <Menu style={{ margin: 0, padding: 0 }}>
                <Menu.Item as={Link} to="/">KIND FOOD ERP-System</Menu.Item>
                <Menu.Item>
                    <Search />
                </Menu.Item>
                <Menu.Menu position='right'>
                    {user ? (
                        <>
                            <Dropdown item text='操作' style={styles.dropdownButton}>
                                <Dropdown.Menu>
                                    <Dropdown.Item as={Link} to="/new-bomtable" style={styles.dropdownItem}>
                                        建立 BOM 表
                                    </Dropdown.Item>
                                    <Dropdown.Item as={Link} to="/new-shared-material" style={styles.dropdownItem}>
                                        建立共用料
                                    </Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>

                            <Dropdown item text='查看' style={styles.dropdownButton}>
                                <Dropdown.Menu>
                                    <Dropdown.Item as={Link} to="/bom-table" style={styles.dropdownItem}>
                                        查看 BOM 表
                                    </Dropdown.Item>
                                    <Dropdown.Item as={Link} to="/shared-material" style={styles.dropdownItem}>
                                        查看共用料
                                    </Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>

                            <Dropdown item text='報價' style={styles.pricingButton}>
                                <Dropdown.Menu>
                                    <Dropdown.Item 
                                        as={Link} 
                                        to="/excel-analysis" 
                                        style={styles.dropdownItem}
                                    >
                                        官網報價分析
                                    </Dropdown.Item>
                                    <Dropdown.Item 
                                        as={Link} 
                                        to="/saved-pricing" 
                                        style={styles.dropdownItem}
                                    >
                                        經銷報價計算
                                    </Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>

                            <Menu.Item 
                                as={Link} 
                                to="/profile"
                                style={styles.profileButton}
                                onMouseEnter={(e) => handleMouseEnter(e, styles.profileButtonHover)}
                                onMouseLeave={(e) => handleMouseLeave(e, styles.profileButton)}
                            >
                                個人資料
                            </Menu.Item>
                            <Menu.Item onClick={handleLogout}>
                                登出
                            </Menu.Item>
                        </>
                    ) : (
                        <Menu.Item as={Link} to="/signin">
                            登入
                        </Menu.Item>
                    )}
                </Menu.Menu>
            </Menu>

            <Dimmer active={isLoggingOut} page>
                <Loader size='large'>登出中，請稍候...</Loader>
            </Dimmer>
        </>
    );
}

export default Header;