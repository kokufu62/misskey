<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader>
	<MkSpacer :contentMax="1200">
		<div class="_gaps_s">
			<MkUserList :pagination="tagUsers"/>
		</div>
	</MkSpacer>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import MkUserList from '@/components/MkUserList.vue';
import { definePage } from '@/page.js';

const props = defineProps<{
	tag: string;
}>();

const tagUsers = computed(() => ({
	endpoint: 'hashtags/users' as const,
	limit: 30,
	params: {
		tag: props.tag,
		origin: 'combined',
		sort: '+follower',
	},
}));

definePage(() => ({
	title: props.tag,
	icon: 'ti ti-user-search',
}));
</script>

