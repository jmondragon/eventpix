import { AppShell, Burger, Group, NavLink, Text, Button, Menu, Avatar } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconDashboard, IconPhoto, IconSettings, IconUsers, IconGavel, IconLogout } from '@tabler/icons-react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';

export function AppLayout() {
    const [opened, { toggle }] = useDisclosure();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    const links = [
        { icon: IconDashboard, label: 'Dashboard', to: '/' },
        { icon: IconPhoto, label: 'Events', to: '/events' },
        { icon: IconGavel, label: 'Moderation', to: '/moderation' },
        { icon: IconUsers, label: 'Membership', to: '/membership' },
        { icon: IconSettings, label: 'Settings', to: '/settings' },
    ];

    const items = links.map((link) => (
        <NavLink
            key={link.label}
            active={location.pathname === link.to}
            label={link.label}
            leftSection={<link.icon size="1rem" stroke={1.5} />}
            onClick={() => {
                navigate(link.to);
                if (opened) toggle();
            }}
        />
    ));

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <AppShell
            header={{ height: 60 }}
            navbar={{
                width: 300,
                breakpoint: 'sm',
                collapsed: { mobile: !opened },
            }}
            padding="md"
        >
            <AppShell.Header>
                <Group h="100%" px="md" justify="space-between">
                    <Group>
                        <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
                        <Text fw={700} size="xl">EventPix Admin</Text>
                    </Group>

                    <Menu shadow="md" width={200}>
                        <Menu.Target>
                            <Button variant="subtle" leftSection={<Avatar size="sm" radius="xl" />} rightSection={<Text size="sm">{user?.email}</Text>}>
                            </Button>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Item leftSection={<IconLogout size={14} />} color="red" onClick={handleLogout}>
                                Logout
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                </Group>
            </AppShell.Header>

            <AppShell.Navbar p="md">
                {items}
            </AppShell.Navbar>

            <AppShell.Main>
                <Outlet />
            </AppShell.Main>
        </AppShell>
    );
}
