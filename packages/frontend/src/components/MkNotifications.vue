<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkPullToRefresh :refresher="() => reload()">
	<MkPagination ref="pagingComponent" :pagination="pagination">
		<template #empty>
			<div class="_fullinfo">
				<img :src="infoImageUrl" draggable="false"/>
				<div>{{ i18n.ts.noNotifications }}</div>
			</div>
		</template>

		<template #default="{ items: notifications }">
			<MkDateSeparatedList v-slot="{ item: notification }" :class="$style.list" :items="notifications" :noGap="true">
				<MkNote v-if="['reply', 'quote', 'mention'].includes(notification.type)" :key="notification.id + ':note'" :note="notification.note" :withHardMute="true"/>
				<XNotification v-else :key="notification.id" :notification="notification" :withTime="true" :full="true" class="_panel"/>
			</MkDateSeparatedList>
		</template>
	</MkPagination>
</MkPullToRefresh>
</template>

<script lang="ts" setup>
import { onUnmounted, onDeactivated, onMounted, computed, useTemplateRef, onActivated } from 'vue';
import * as Misskey from 'misskey-js';
import type { notificationTypes } from '@@/js/const.js';
import MkPagination from '@/components/MkPagination.vue';
import XNotification from '@/components/MkNotification.vue';
import MkDateSeparatedList from '@/components/MkDateSeparatedList.vue';
import MkNote from '@/components/MkNote.vue';
import { useStream } from '@/stream.js';
import { i18n } from '@/i18n.js';
import { infoImageUrl } from '@/instance.js';
import MkPullToRefresh from '@/components/MkPullToRefresh.vue';
import { prefer } from '@/preferences.js';

const props = defineProps<{
	excludeTypes?: typeof notificationTypes[number][];
}>();

const pagingComponent = useTemplateRef('pagingComponent');

const pagination = computed(() => prefer.r.useGroupedNotifications.value ? {
	endpoint: 'i/notifications-grouped' as const,
	limit: 20,
	params: computed(() => ({
		excludeTypes: props.excludeTypes ?? undefined,
	})),
} : {
	endpoint: 'i/notifications' as const,
	limit: 20,
	params: computed(() => ({
		excludeTypes: props.excludeTypes ?? undefined,
	})),
});

function onNotification(notification) {
	const isMuted = props.excludeTypes ? props.excludeTypes.includes(notification.type) : false;
	if (isMuted || window.document.visibilityState === 'visible') {
		useStream().send('readNotification');
	}

	if (!isMuted) {
		pagingComponent.value?.prepend(notification);
	}
}

function reload() {
	return new Promise<void>((res) => {
		pagingComponent.value?.reload().then(() => {
			res();
		});
	});
}

let connection: Misskey.ChannelConnection<Misskey.Channels['main']>;

onMounted(() => {
	connection = useStream().useChannel('main');
	connection.on('notification', onNotification);
	connection.on('notificationFlushed', reload);
});

onActivated(() => {
	pagingComponent.value?.reload();
	connection = useStream().useChannel('main');
	connection.on('notification', onNotification);
	connection.on('notificationFlushed', reload);
});

onUnmounted(() => {
	if (connection) connection.dispose();
});

onDeactivated(() => {
	if (connection) connection.dispose();
});

defineExpose({
	reload,
});
</script>

<style lang="scss" module>
.list {
	background: var(--MI_THEME-panel);
}
</style>
