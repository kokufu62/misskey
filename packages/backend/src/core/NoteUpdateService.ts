/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as mfm from 'mfm-js';
import { In, Not, IsNull, Brackets } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import { extractMentions } from '@/misc/extract-mentions.js';
import { extractCustomEmojisFromMfm } from '@/misc/extract-custom-emojis-from-mfm.js';
import { extractHashtags } from '@/misc/extract-hashtags.js';
import type { IMentionedRemoteUsers } from '@/models/Note.js';
import { MiNote } from '@/models/Note.js';
import type { DriveFilesRepository, InstancesRepository, MiMeta, NotesRepository, UserProfilesRepository, UsersRepository } from '@/models/_.js';
import type { MiDriveFile } from '@/models/DriveFile.js';
import type { MiUser, MiLocalUser, MiRemoteUser } from '@/models/User.js';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { RelayService } from '@/core/RelayService.js';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { bindThis } from '@/decorators.js';
import { DB_MAX_NOTE_TEXT_LENGTH } from '@/const.js';
import { SearchService } from '@/core/SearchService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';

type Option = {
	text?: string | null;
	cw?: string | null;
	fileIds?: MiDriveFile['id'][];
};

@Injectable()
export class NoteUpdateService {
	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.meta)
		private meta: MiMeta,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		@Inject(DI.instancesRepository)
		private instancesRepository: InstancesRepository,

		private userEntityService: UserEntityService,
		private noteEntityService: NoteEntityService,
		private globalEventService: GlobalEventService,
		private relayService: RelayService,
		private apDeliverManagerService: ApDeliverManagerService,
		private apRendererService: ApRendererService,
		private remoteUserResolveService: RemoteUserResolveService,
		private searchService: SearchService,
		private utilityService: UtilityService,
	) {}

	@bindThis
	public async update(user: MiLocalUser, note: MiNote, data: Option): Promise<MiNote> {
		if (note.userId !== user.id) {
			throw new IdentifiableError('fe8d7103-0ea8-4ec3-814d-f8b401dc69e9', 'Access denied');
		}

		if (note.userHost !== null) {
			throw new IdentifiableError('c1e19d67-27b9-4c6e-8d8a-9f5e04a11f23', 'Cannot edit remote note');
		}

		let files: MiDriveFile[] | null = null;
		if (data.fileIds != null) {
			if (data.fileIds.length > 0) {
				files = await this.driveFilesRepository.findBy({
					id: In(data.fileIds),
					userId: user.id,
				});

				if (files.length !== data.fileIds.length) {
					throw new IdentifiableError('801c046c-5bf5-4234-ad2b-e78fc20a2ac7', 'No such file');
				}
			} else {
				files = [];
			}
		}

		let text = data.text !== undefined ? data.text : note.text;
		let cw = data.cw !== undefined ? data.cw : note.cw;

		if (text) {
			if (text.length > DB_MAX_NOTE_TEXT_LENGTH) {
				text = text.slice(0, DB_MAX_NOTE_TEXT_LENGTH);
			}
			text = text.trim();
			if (text === '') {
				text = null;
			}
		} else {
			text = null;
		}

		if (cw) {
			if (cw.length > DB_MAX_NOTE_TEXT_LENGTH) {
				cw = cw.slice(0, DB_MAX_NOTE_TEXT_LENGTH);
			}
			cw = cw.trim();
			if (cw === '') {
				cw = null;
			}
		} else {
			cw = null;
		}

		// Parse MFM
		const tokens = (text ? mfm.parse(text)! : []);
		const cwTokens = (cw ? mfm.parse(cw)! : []);
		const combinedTokens = tokens.concat(cwTokens);

		let tags = extractHashtags(combinedTokens);
		let emojis = extractCustomEmojisFromMfm(combinedTokens);
		const mentionedUsers = await this.extractMentionedUsers(user, combinedTokens);

		if (this.utilityService.isMediaSilencedHost(this.meta.mediaSilencedHosts, user.host)) {
			emojis = [];
		}

		tags = tags.filter(tag => Array.from(tag).length <= 128).splice(0, 32);

		// Noteオブジェクトの更新
		note.text = text;
		note.cw = cw;
		if (files != null) {
			note.fileIds = files.map(f => f.id);
			note.attachedFileTypes = files.map(f => f.type);
		}
		note.emojis = emojis;
		note.tags = tags.map(tag => normalizeForSearch(tag));

		if (mentionedUsers.length > 0) {
			note.mentions = mentionedUsers.map(u => u.id);
			const profiles = await this.userProfilesRepository.findBy({ userId: In(note.mentions) });
			note.mentionedRemoteUsers = JSON.stringify(mentionedUsers.filter(u => this.userEntityService.isRemoteUser(u)).map(u => {
				const profile = profiles.find(p => p.userId === u.id);
				const url = profile != null ? profile.url : null;
				return {
					uri: (u as MiRemoteUser).uri,
					url: url ?? undefined,
					username: u.username,
					host: u.host,
				};
			}));
		} else {
			note.mentions = [];
			note.mentionedRemoteUsers = '[]';
		}

		await this.notesRepository.save(note);

		// 検索インデックスの更新
		this.searchService.indexNote(note);

		// リアルタイム通知
		this.globalEventService.publishNoteStream(note, 'updated', {
			text: note.text ?? '',
			cw: note.cw,
		});

		// ActivityPub配送 (ローカル公開ノートの場合)
		if (this.userEntityService.isLocalUser(user) && !note.localOnly) {
			const renderedNote = await this.apRendererService.renderNote(note, false);
			const content = this.apRendererService.addContext(this.apRendererService.renderUpdate(renderedNote, user));
			this.deliverToConcerned(user, note, content);
		}

		return note;
	}

	@bindThis
	private async extractMentionedUsers(user: { host: MiUser['host']; }, tokens: mfm.MfmNode[]): Promise<MiUser[]> {
		if (tokens == null) return [];

		const mentions = extractMentions(tokens);
		let mentionedUsers = (await Promise.all(mentions.map(m =>
			this.remoteUserResolveService.resolveUser(m.username, m.host ?? user.host).catch(() => null),
		))).filter(x => x != null);

		// 重複削除
		mentionedUsers = mentionedUsers.filter((u, i, self) =>
			i === self.findIndex(u2 => u.id === u2.id),
		);

		return mentionedUsers;
	}

	@bindThis
	private async getMentionedRemoteUsers(note: MiNote) {
		const where = [] as any[];

		const uris = (JSON.parse(note.mentionedRemoteUsers) as IMentionedRemoteUsers).map(x => x.uri);
		if (uris.length > 0) {
			where.push({ uri: In(uris) });
		}

		if (note.renoteUserId) {
			where.push({ id: note.renoteUserId });
		}

		if (where.length === 0) return [];

		return await this.usersRepository.find({ where }) as MiRemoteUser[];
	}

	@bindThis
	private async getRenotedOrRepliedRemoteUsers(note: MiNote) {
		const query = this.notesRepository.createQueryBuilder('note')
			.leftJoinAndSelect('note.user', 'user')
			.where(new Brackets(qb => {
				qb.orWhere('note.renoteId = :renoteId', { renoteId: note.id });
				qb.orWhere('note.replyId = :replyId', { replyId: note.id });
			}))
			.andWhere({ userHost: Not(IsNull()) });
		const notes = await query.getMany() as (MiNote & { user: MiRemoteUser })[];
		return notes.map(({ user }) => user);
	}

	@bindThis
	private async deliverToConcerned(user: { id: MiLocalUser['id']; host: null; }, note: MiNote, content: any) {
		this.apDeliverManagerService.deliverToFollowers(user, content);
		this.relayService.deliverToRelays(user, content);
		this.apDeliverManagerService.deliverToUsers(user, content, [
			...await this.getMentionedRemoteUsers(note),
			...await this.getRenotedOrRepliedRemoteUsers(note),
		]);
	}
}
