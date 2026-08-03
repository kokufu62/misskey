/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import ms from 'ms';
import { Injectable } from '@nestjs/common';
import { MAX_NOTE_TEXT_LENGTH } from '@/const.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { GetterService } from '@/server/api/GetterService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { NoteUpdateService } from '@/core/NoteUpdateService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['notes'],

	requireCredential: true,

	prohibitMoved: true,

	kind: 'write:notes',

	limit: {
		duration: ms('1hour'),
		max: 300,
		minInterval: ms('1sec'),
	},

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			updatedNote: {
				type: 'object',
				optional: false, nullable: false,
				ref: 'Note',
			},
		},
	},

	errors: {
		noSuchNote: {
			message: 'No such note.',
			code: 'NO_SUCH_NOTE',
			id: '490be23f-8c1f-4796-819f-94cb4f9d1630',
		},

		accessDenied: {
			message: 'Access denied.',
			code: 'ACCESS_DENIED',
			id: 'fe8d7103-0ea8-4ec3-814d-f8b401dc69e9',
		},

		cannotEditRemoteNote: {
			message: 'Cannot edit remote note.',
			code: 'CANNOT_EDIT_REMOTE_NOTE',
			id: 'c1e19d67-27b9-4c6e-8d8a-9f5e04a11f23',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		noteId: { type: 'string', format: 'misskey:id' },
		text: { type: 'string', nullable: true, maxLength: MAX_NOTE_TEXT_LENGTH },
		cw: { type: 'string', nullable: true, maxLength: MAX_NOTE_TEXT_LENGTH },
		fileIds: {
			type: 'array',
			items: { type: 'string', format: 'misskey:id' },
			uniqueItems: true,
		},
	},
	required: ['noteId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private getterService: GetterService,
		private noteEntityService: NoteEntityService,
		private noteUpdateService: NoteUpdateService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const note = await this.getterService.getNote(ps.noteId).catch(err => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') throw new ApiError(meta.errors.noSuchNote);
				throw err;
			});

			if (note.userId !== me.id) {
				throw new ApiError(meta.errors.accessDenied);
			}

			if (note.userHost !== null) {
				throw new ApiError(meta.errors.cannotEditRemoteNote);
			}

			const updated = await this.noteUpdateService.update(me, note, {
				text: ps.text,
				cw: ps.cw,
				fileIds: ps.fileIds,
			});

			return {
				updatedNote: await this.noteEntityService.pack(updated, me, {
					detail: true,
				}),
			};
		});
	}
}
