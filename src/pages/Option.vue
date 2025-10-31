<script setup lang="ts">
import { ref, onMounted, watchEffect, useTemplateRef } from "vue";
import {
    NButton,
    NIcon,
    NModal,
    NUpload,
    NUploadDragger,
    UploadFileInfo,
    UploadSettledFileInfo,
} from "naive-ui";
import browser from "webextension-polyfill";
import { useElementHover } from "@vueuse/core";

// 安全的 URL 解码函数
function decodeURIComponentSafe(encoded: string): string {
    try {
        return decodeURIComponent(encoded);
    } catch (error) {
        console.error("Failed to decodeURIComponent:", error);
        return encoded; // 如果解码失败，返回原始字符串
    }
}

// 获取当前页面的完整 URL
const FullPath = window.location.href;
// 从 FullPath 中提取出当前页面的路径
const Path = FullPath.split("/").pop();
console.log("FullPath:", FullPath);
console.log("Path:", Path);
const snapshotBox = ref<HTMLElement | null>(null)
// 解析 URL 参数
const urlParams = new URLSearchParams(window.location.search);
console.log("URL Params:", urlParams);
const title = ref<string>(urlParams.get("title") || "");
const url = ref<string>(
    urlParams.get("url")
        ? decodeURIComponentSafe(urlParams.get("url")!)
        : ""
);
const icon = ref<string>(urlParams.get("icon") || "");
const background = ref<string>();
const snapshot = ref<string>("");

// 设置当前页面的标题和图标
onMounted(() => {
    if (title.value) {
        document.title = title.value;
    } else {
        document.title = "Options";
    }

    if (icon.value) {
        const link = document.createElement("link");
        link.rel = "icon";
        link.href = icon.value;
        document.head.appendChild(link);
    }
    console.log("Title:", title.value);
    console.log("URL:", url.value);
    console.log("Icon:", icon.value);

    // 监听来自背景脚本的消息
    browser.runtime.onMessage.addListener((message: any) => {
        if (message.type === "setSnapshot") {
            snapshot.value = message.snapshot;
        }
    });
    browser.storage.local.get("backgroundImage").then((result: any) => {
        if (result.backgroundImage) {
            background.value = result.backgroundImage;
            document.body.style.backgroundImage = `url(${background.value})`;
            document.body.style.backgroundSize = "cover";
        }
    });
});

// URL 规范化函数，用于比较
function normalizeUrl(inputUrl: string): string {
    try {
        const url = new URL(inputUrl);
        // 移除 hash 和搜索参数（可选，根据需要调整）
        return url.origin + url.pathname;
    } catch {
        return inputUrl;
    }
}

// 更可靠的匹配函数
function findFreezeTabByUrl(targetUrl: string, freezeTabs: any[]): any | null {
    if (!freezeTabs || freezeTabs.length === 0) return null;

    const normalizedTarget = normalizeUrl(targetUrl);

    // 1. 精确匹配
    let match = freezeTabs.find(tab => tab.url === targetUrl);
    if (match) return match;

    // 2. 规范化匹配
    match = freezeTabs.find(tab => normalizeUrl(tab.url) === normalizedTarget);
    if (match) return match;

    // 3. URL 包含匹配（处理部分匹配）
    match = freezeTabs.find(tab =>
        tab.url.includes(targetUrl) || targetUrl.includes(tab.url)
    );
    if (match) return match;

    // 4. 规范化包含匹配
    match = freezeTabs.find(tab => {
        const normalizedTab = normalizeUrl(tab.url);
        return normalizedTab.includes(normalizedTarget) || normalizedTarget.includes(normalizedTab);
    });
    if (match) return match;

    return null;
}

function BackSource() {
    window.location.href = url.value;

    // 通知移除freezeTab - 使用更可靠的匹配机制
    browser.storage.sync.get('freezeTabStatusList').then((result: any) => {
        if (!result.freezeTabStatusList) {
            console.log('No freezeTabStatusList found');
            return;
        }

        const freezeTab = findFreezeTabByUrl(url.value, result.freezeTabStatusList);

        if (freezeTab) {
            browser.runtime.sendMessage({ RemoveFreezeTab: freezeTab.tabId }).then((response) => {
                console.log('RemoveFreezeTab:', response);
            }).catch((error) => {
                console.error('Error sending RemoveFreezeTab:', error);
            });
        } else {
            console.warn('No matching freeze tab found for URL:', url.value);
            // 如果找不到匹配项，尝试通过标题匹配
            const titleMatch = result.freezeTabStatusList.find((item: any) =>
                item.title === title.value
            );
            if (titleMatch) {
                browser.runtime.sendMessage({ RemoveFreezeTab: titleMatch.tabId }).then((response) => {
                    console.log('RemoveFreezeTab by title match:', response);
                });
            }
        }
    }).catch((error) => {
        console.error('Error getting freezeTabStatusList:', error);
    });
}
const showModal = ref(false);
const previewFileList = ref<UploadFileInfo[]>();
const previewImageUrl = ref<string>();
const showPreview = ref(false);
watchEffect(() => {
    console.log("previewFileList:", previewFileList.value);
});
function handleFinish({
    file,
    event,
}: {
    file: UploadSettledFileInfo;
    event?: ProgressEvent;
}) {
    SaveBackgroundImage(file);
}
function SaveBackgroundImage(file: UploadSettledFileInfo) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const base64 = e.target?.result;
        browser.storage.local.set({ backgroundImage: base64 });
        background.value = base64 as string;
        document.body.style.backgroundImage = `url(${background.value})`;
        document.body.style.backgroundSize = "cover";
        showModal.value = false;
    };
    reader.readAsDataURL(file.file!);
}
function onChange({ file, fileList }: { file: any, fileList: any[] }) {
    console.log("onChange:", { file, fileList });
}
</script>

<template>
    <div class="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 p-8 overflow-hidden relative">
        <!-- 背景装饰 -->
        <div class="absolute inset-0 overflow-hidden">
            <div class="absolute -top-1/3 -left-1/3 w-2/3 h-2/3 bg-cyan-400/10 rounded-full blur-3xl"></div>
            <div class="absolute -bottom-1/3 -right-1/3 w-2/3 h-2/3 bg-blue-400/10 rounded-full blur-3xl delay-1000"></div>
            <div class="absolute top-1/3 left-1/3 w-1/2 h-1/2 bg-indigo-400/8 rounded-full blur-2xl delay-2000"></div>
        </div>

        <!-- 页面快照背景 -->
        <div v-if="snapshot && !background" class="absolute inset-0 w-full h-full">
            <img :src="snapshot" alt="Snapshot" class="w-full h-full object-cover opacity-60" />
            <div class="absolute inset-0 bg-gradient-to-t from-slate-800/40 via-slate-800/20 via-transparent to-slate-800/30"></div>
        </div>

        <!-- 自定义背景 -->
        <div v-if="background" class="absolute inset-0 w-full h-full">
            <img :src="background" alt="Custom Background" class="w-full h-full object-cover opacity-70" />
            <div class="absolute inset-0 bg-gradient-to-t from-slate-800/50 via-slate-800/25 via-transparent to-slate-800/35"></div>
        </div>

        <!-- 主内容 -->
        <div class="relative z-10 min-h-screen flex flex-col justify-center items-center text-center">
            <!-- 卡片容器 -->
            <div class="group relative bg-slate-700/40 backdrop-blur-xl rounded-2xl p-12 max-w-2xl w-full mx-auto border border-slate-600/60 shadow-2xl hover:bg-slate-700/50 transition-all duration-700 hover:shadow-3xl hover:scale-[1.02] cursor-pointer" @click="BackSource">
                <!-- 玻璃拟态装饰边框 -->
                <div class="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-400/10 via-blue-400/10 to-indigo-400/8 opacity-60 group-hover:opacity-80 transition-opacity duration-700"></div>

                <!-- 内容 -->
                <div class="relative z-10">
                    <!-- 网站图标 -->
                    <div class="mb-8 flex justify-center">
                        <div class="relative group/icon">
                            <div class="absolute inset-0 bg-gradient-to-br from-cyan-400/25 to-blue-400/25 rounded-2xl blur-md opacity-70 group-hover/icon:opacity-90 transition-opacity duration-500"></div>
                            <div class="relative bg-slate-600/40 backdrop-blur-sm rounded-2xl p-4 border border-slate-500/50">
                                <img v-if="icon" :src="icon" :alt="title" class="w-20 h-20 rounded-xl object-cover opacity-95" />
                                <img v-else src="/icon-with-shadow.svg" alt="Default Icon" class="w-20 h-20 rounded-xl opacity-90" />
                            </div>
                        </div>
                    </div>

                    <!-- 标题和URL信息 -->
                    <div class="mb-8">
                        <h1 class="text-3xl md:text-4xl font-light text-white mb-6 leading-tight">
                            {{ title || "页面已冻结" }}
                        </h1>

                        <div class="bg-slate-600/40 backdrop-blur-sm rounded-xl p-4 border border-slate-500/40">
                            <div class="flex items-center justify-center text-slate-200 text-sm">
                                <svg class="w-4 h-4 mr-2 text-cyan-400/80" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.497-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clip-rule="evenodd" />
                                </svg>
                                <span class="truncate max-w-lg font-light">{{ url || "未知地址" }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- 冻结状态指示器 -->
                    <div class="flex items-center justify-center mb-8">
                        <div class="relative">
                            <div class="absolute inset-0 bg-gradient-to-r from-cyan-400/35 to-blue-400/25 rounded-full blur-md opacity-60"></div>
                            <div class="relative bg-slate-600/50 backdrop-blur-sm text-white px-6 py-3 rounded-full text-sm font-light flex items-center space-x-2 border border-slate-500/60">
                                <svg class="w-4 h-4 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-3 3v-6m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span class="font-light">页面已冻结</span>
                            </div>
                        </div>
                    </div>

                    <!-- 操作按钮 -->
                    <div class="flex flex-col sm:flex-row gap-6 justify-center items-center">
                        <button class="group/btn relative bg-gradient-to-r from-cyan-400 to-blue-500 text-white px-8 py-3 rounded-xl font-light flex items-center space-x-3 hover:from-cyan-500 hover:to-blue-600 transition-all duration-500 transform hover:scale-[1.02] hover:shadow-lg">
                            <div class="absolute inset-0 bg-slate-600/20 rounded-xl opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500"></div>
                            <div class="relative z-10 flex items-center space-x-3">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <span class="font-light">恢复页面</span>
                            </div>
                        </button>

                        <button class="group/btn relative bg-slate-600/40 backdrop-blur-sm text-slate-200 px-6 py-3 rounded-xl font-light border border-slate-500/50 hover:bg-slate-600/50 transition-all duration-500" @click.stop="showModal = true">
                            <div class="absolute inset-0 bg-gradient-to-r from-cyan-400/15 to-blue-400/15 rounded-xl opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500"></div>
                            <div class="relative z-10 flex items-center space-x-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span class="font-light">自定义背景</span>
                            </div>
                        </button>
                    </div>

                    <!-- 点击提示 -->
                    <div class="mt-8 text-slate-300/70 text-sm font-light">
                        点击卡片任意位置恢复页面
                    </div>
                </div>
            </div>

            <!-- 底部信息 -->
            <div class="mt-12 text-slate-400/60 text-xs font-light">
                <p>Yuanfang标签页管理器 · 智能冻结系统</p>
            </div>
        </div>

        <!-- 背景上传模态框 -->
        <NModal v-model:show="showModal" class="max-w-md">
            <div class="bg-gradient-to-br from-slate-700 to-slate-800 backdrop-blur-xl rounded-2xl p-6 border border-slate-600/60">
                <NUpload :max="1" :default-file-list="previewFileList" list-type="image"
                    file-list-class="bg-slate-600/40 backdrop-blur-sm rounded-lg border border-slate-500/50"
                    action="" @finish="handleFinish" @change="onChange">
                    <NUploadDragger class="!bg-slate-600/30 !border-slate-500/60 hover:!bg-slate-600/40 transition-colors">
                        <div class="text-center py-8">
                            <div class="mb-4 flex justify-center">
                                <div class="bg-gradient-to-br from-cyan-400/15 to-blue-400/15 rounded-2xl p-4">
                                    <svg class="w-12 h-12 text-slate-300/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>
                            </div>
                            <div class="text-slate-200/90 text-lg font-light mb-2">上传自定义背景</div>
                            <div class="text-slate-300/70 text-sm font-light">点击或者拖动图片文件到该区域</div>
                        </div>
                    </NUploadDragger>
                </NUpload>
            </div>
        </NModal>
    </div>
</template>

<style>
* {
    user-select: none;
}

/* 确保背景层级正确 */
body {
    margin: 0;
    padding: 0;
    overflow-x: hidden;
}

/* 自定义动画延迟类 */
.delay-1000 {
    animation-delay: 1s;
}

.delay-2000 {
    animation-delay: 2s;
}

/* 确保模态框层级正确 */
.n-modal {
    z-index: 9999 !important;
}

/* 玻璃拟态效果增强 */
.backdrop-blur-xl {
    backdrop-filter: blur(16px);
}
</style>
