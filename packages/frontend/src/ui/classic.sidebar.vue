<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="npcljfve" :class="{ iconOnly }">
	<button v-click-anime class="item _button account" @click="openAccountMenu">
		<MkAvatar :user="$i" class="avatar"/><MkAcct class="text" :user="$i"/>
	</button>
	<div class="post" data-cy-open-post-form @click="os.post">
		<MkButton class="button" gradate full rounded>
			<i class="ti ti-pencil ti-fw"></i><span v-if="!iconOnly" class="text">{{ i18n.ts.note }}</span>
		</MkButton>
	</div>
	<div class="divider"></div>
	<MkA v-click-anime class="item index" activeClass="active" to="/" exact>
		<i class="ti ti-home ti-fw"></i><span class="text">{{ i18n.ts.timeline }}</span>
	</MkA>
	<template v-for="item in menu">
		<div v-if="item === '-'" class="divider"></div>
		<component :is="navbarItemDef[item].to ? 'MkA' : 'button'" v-else-if="navbarItemDef[item] && (navbarItemDef[item].show !== false)" v-click-anime class="item _button" :class="item" activeClass="active" :to="navbarItemDef[item].to" v-on="navbarItemDef[item].action ? { click: navbarItemDef[item].action } : {}">
			<i class="ti-fw" :class="navbarItemDef[item].icon"></i><span class="text">{{ navbarItemDef[item].title }}</span>
			<span v-if="navbarItemDef[item].indicated" class="indicator _blink">
				<span v-if="navbarItemDef[item].indicateValue" class="_indicateCounter itemIndicateValueIcon">{{ navbarItemDef[item].indicateValue }}</span>
				<i v-else class="_indicatorCircle"></i>
			</span>
		</component>
	</template>
	<div class="divider"></div>
	<MkA v-if="$i.isAdmin || $i.isModerator" v-click-anime class="item" activeClass="active" to="/admin" :behavior="settingsWindowed ? 'window' : null">
		<i class="ti ti-dashboard ti-fw"></i><span class="text">{{ i18n.ts.controlPanel }}</span>
	</MkA>
	<button v-click-anime class="item _button" @click="more">
		<i class="ti ti-dots ti-fw"></i><span class="text">{{ i18n.ts.more }}</span>
		<span v-if="otherNavItemIndicated" class="indicator _blink"><i class="_indicatorCircle"></i></span>
	</button>
	<MkA v-click-anime class="item" activeClass="active" to="/settings" :behavior="settingsWindowed ? 'window' : null">
		<i class="ti ti-settings ti-fw"></i><span class="text">{{ i18n.ts.settings }}</span>
	</MkA>
	<div class="divider"></div>
	<div class="about">
		<button v-click-anime class="item _button" @click="openInstanceMenu">
			<img :src="instance.iconUrl ?? instance.faviconUrl ?? '/favicon.ico'" draggable="false"/>
		</button>
	</div>
	<!--<MisskeyLogo class="misskey"/>-->
</div>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, computed, watch, ref, useTemplateRef } from 'vue';
import { openInstanceMenu } from './_common_/common.js';
// import { host } from '@@/js/config.js';
import * as os from '@/os.js';
import { navbarItemDef } from '@/navbar.js';
import MkButton from '@/components/MkButton.vue';
// import { StickySidebar } from '@/utility/sticky-sidebar.js';
// import { mainRouter } from '@/router.js';
//import MisskeyLogo from '@assets/client/misskey.svg';
import { store } from '@/store.js';
import { instance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { openAccountMenu as openAccountMenu_ } from '@/accounts.js';
import { $i } from '@/i.js';

const WINDOW_THRESHOLD = 1400;

const menu = ref(prefer.s.menu);
const menuDisplay = computed(store.makeGetterSetter('menuDisplay'));
const otherNavItemIndicated = computed<boolean>(() => {
	for (const def in navbarItemDef) {
		if (menu.value.includes(def)) continue;
		if (navbarItemDef[def].indicated) return true;
	}
	return false;
});
const el = useTemplateRef('el');
// let accounts = $ref([]);
// let connection = $ref(null);
const iconOnly = ref(false);
const settingsWindowed = ref(false);

function calcViewState() {
	iconOnly.value = (window.innerWidth <= WINDOW_THRESHOLD) || (menuDisplay.value === 'sideIcon');
	settingsWindowed.value = (window.innerWidth > WINDOW_THRESHOLD);
}

function more(ev: MouseEvent) {
	const { dispose } = os.popup(defineAsyncComponent(() => import('@/components/MkLaunchPad.vue')), {
		src: ev.currentTarget ?? ev.target,
	}, {
		closed: () => dispose(),
	});
}

function openAccountMenu(ev: MouseEvent) {
	openAccountMenu_({
		withExtraOperation: true,
	}, ev);
}

watch(store.r.menuDisplay, () => {
	calcViewState();
});

</script>

<style lang="scss" scoped>
.npcljfve {
	$ui-font-size: 1em; // TODO: どこかに集約したい
	$nav-icon-only-width: 78px; // TODO: どこかに集約したい
	$avatar-size: 32px;
	$avatar-margin: 8px;

	padding: 0 16px;
	box-sizing: border-box;
	width: 260px;

	&.iconOnly {
		flex: 0 0 $nav-icon-only-width;
		width: $nav-icon-only-width !important;

		> .divider {
			margin: 8px auto;
			width: calc(100% - 32px);
		}

		> .post {
			> .button {
				width: 46px;
				height: 46px;
				padding: 0;
			}
		}

		> .item {
			padding-left: 0;
			width: 100%;
			text-align: center;
			font-size: $ui-font-size * 1.1;
			line-height: 3.7rem;

			> i,
			> .avatar {
				margin-right: 0;
			}

			> i {
				left: 10px;
			}

			> .text {
				display: none;
			}
		}
	}

	> .divider {
		margin: 10px 0;
		border-top: solid 0.5px var(--MI_THEME-divider);
	}

	> .post {
		position: sticky;
		top: 0;
		z-index: 1;
		padding: 16px 0;
		background: var(--MI_THEME-bg);

		> .button {
			min-width: 0;
		}
	}

	> .about {
		fill: currentColor;
		padding: 8px 0 16px 0;
		text-align: center;

		> .item {
			display: block;
			width: 32px;
			margin: 0 auto;

			img {
				display: block;
				width: 100%;
			}
		}
	}

	> .item {
		position: relative;
		display: block;
		font-size: $ui-font-size;
		line-height: 2.6rem;
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
		width: 100%;
		text-align: left;
		box-sizing: border-box;

		> i {
			width: 32px;
		}

		> i,
		> .avatar {
			margin-right: $avatar-margin;
		}

		> .avatar {
			width: $avatar-size;
			height: $avatar-size;
			vertical-align: middle;
		}

		> .indicator {
			position: absolute;
			top: 0;
			left: 0;
			color: var(--MI_THEME-navIndicator);
			font-size: 8px;

			&:has(.itemIndicateValueIcon) {
				animation: none;
				left: auto;
				right: 20px;
			}
		}

		&:hover {
			text-decoration: none;
			color: var(--MI_THEME-navHoverFg);
		}

		&.active {
			color: var(--MI_THEME-navActive);
		}
	}
}
</style>
