import { Container, Title, Card, Text, Group, Badge, Progress, Button, SimpleGrid, List, ThemeIcon, Stack } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';

export default function MembershipPage() {
    // Mock Data
    const isPro = false;
    const eventUsage = 2;
    const eventLimit = 5;
    const storageUsage = 85;

    return (
        <Container size="lg">
            <Title order={2} mb="xl">Membership & Billing</Title>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                {/* Current Plan Card */}
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Group justify="space-between" mb="xs">
                        <Text fw={500} c="dimmed" size="xs" tt="uppercase">Current Plan</Text>
                        {!isPro && <Badge color="gray">Free Tier</Badge>}
                        {isPro && <Badge gradient={{ from: 'blue', to: 'cyan' }} variant="gradient">Pro</Badge>}
                    </Group>

                    <Text size="3rem" fw={900} lh={1} mb="md">
                        {isPro ? 'Pro' : 'Free'}
                    </Text>

                    <Stack gap="md" mt="xl">
                        <div>
                            <Group justify="space-between" mb={5}>
                                <Text size="sm">Events Created</Text>
                                <Text size="sm" fw={700}>{eventUsage} / {isPro ? '∞' : eventLimit}</Text>
                            </Group>
                            <Progress value={(eventUsage / eventLimit) * 100} size="lg" radius="xl" />
                        </div>

                        <div>
                            <Group justify="space-between" mb={5}>
                                <Text size="sm">Storage Used</Text>
                                <Text size="sm" fw={700}>{storageUsage}%</Text>
                            </Group>
                            <Progress value={storageUsage} size="lg" radius="xl" color={storageUsage > 80 ? 'orange' : 'blue'} />
                        </div>
                    </Stack>

                    {!isPro && (
                        <Button fullWidth mt="xl" size="md" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
                            Upgrade to Pro
                        </Button>
                    )}
                </Card>

                {/* Plan Features / Comparison */}
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Text fw={700} size="lg" mb="md">Plan Features</Text>
                    <List
                        spacing="sm"
                        size="sm"
                        center
                        icon={
                            <ThemeIcon color="teal" size={24} radius="xl">
                                <IconCheck size="1rem" />
                            </ThemeIcon>
                        }
                    >
                        <List.Item>Unlimited Event Photos</List.Item>
                        <List.Item>Guest Uploads</List.Item>
                        <List.Item
                            icon={
                                isPro ? (
                                    <ThemeIcon color="teal" size={24} radius="xl"><IconCheck size="1rem" /></ThemeIcon>
                                ) : (
                                    <ThemeIcon color="gray" size={24} radius="xl"><IconX size="1rem" /></ThemeIcon>
                                )
                            }
                        >
                            <Text c={isPro ? undefined : "dimmed"}>Remove Watermark</Text>
                        </List.Item>
                        <List.Item
                            icon={
                                isPro ? (
                                    <ThemeIcon color="teal" size={24} radius="xl"><IconCheck size="1rem" /></ThemeIcon>
                                ) : (
                                    <ThemeIcon color="gray" size={24} radius="xl"><IconX size="1rem" /></ThemeIcon>
                                )
                            }
                        >
                            <Text c={isPro ? undefined : "dimmed"}>Priority Support</Text>
                        </List.Item>
                    </List>
                </Card>
            </SimpleGrid>
        </Container>
    );
}
