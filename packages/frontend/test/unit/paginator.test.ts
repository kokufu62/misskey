/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { Paginator } from '@/utility/paginator.js';

const misskeyApiMock = vi.hoisted(() => vi.fn());

vi.mock('@/utility/misskey-api.js', () => {
	return { misskeyApi: misskeyApiMock };
});

describe('Paginator', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	test('init with initialDate and order: oldest (should keep ascending order from API)', async () => {
		misskeyApiMock.mockResolvedValueOnce([
			{ id: '1', createdAt: '2024-01-01T00:00:00.000Z' },
			{ id: '2', createdAt: '2024-01-01T01:00:00.000Z' },
			{ id: '3', createdAt: '2024-01-01T02:00:00.000Z' },
		]);

		const paginator = new Paginator('users/notes', {
			initialDate: 1704067200000,
			initialDirection: 'newer',
			order: 'oldest',
		});

		await paginator.init();

		expect(paginator.items.value.map(x => x.id)).toEqual(['1', '2', '3']);
	});

	test('init with initialId and order: newest with initialDirection: newer (should reverse ascending API response)', async () => {
		misskeyApiMock.mockResolvedValueOnce([
			{ id: '2', createdAt: '2024-01-01T01:00:00.000Z' },
			{ id: '3', createdAt: '2024-01-01T02:00:00.000Z' },
			{ id: '4', createdAt: '2024-01-01T03:00:00.000Z' },
		]);

		const paginator = new Paginator('users/notes', {
			initialId: '1',
			initialDirection: 'newer',
			order: 'newest',
		});

		await paginator.init();

		expect(paginator.items.value.map(x => x.id)).toEqual(['4', '3', '2']);
	});

	test('init with default parameters (order: newest, initialDirection: older)', async () => {
		misskeyApiMock.mockResolvedValueOnce([
			{ id: '3', createdAt: '2024-01-01T02:00:00.000Z' },
			{ id: '2', createdAt: '2024-01-01T01:00:00.000Z' },
			{ id: '1', createdAt: '2024-01-01T00:00:00.000Z' },
		]);

		const paginator = new Paginator('users/notes', {});

		await paginator.init();

		expect(paginator.items.value.map(x => x.id)).toEqual(['3', '2', '1']);
	});
});
