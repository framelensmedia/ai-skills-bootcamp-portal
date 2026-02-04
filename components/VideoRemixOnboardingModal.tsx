"use client";

import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { Image as ImageIcon, Clapperboard, ArrowRight, X } from "lucide-react";

type VideoRemixOnboardingModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onStart: () => void;
};

export default function VideoRemixOnboardingModal({
    isOpen,
    onClose,
    onStart,
}: VideoRemixOnboardingModalProps) {
    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[100]" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-3xl border border-white/10 bg-[#1A1A1A] p-8 text-left align-middle shadow-2xl transition-all">

                                {/* Close Button */}
                                <button
                                    onClick={onClose}
                                    className="absolute top-4 right-4 p-2 text-white/30 hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>

                                <Dialog.Title
                                    as="h3"
                                    className="text-2xl font-bold leading-6 text-white text-center mb-2"
                                >
                                    Remix Video
                                </Dialog.Title>
                                <p className="text-sm text-white/50 text-center mb-8">
                                    Create your own version in 2 simple steps
                                </p>

                                <div className="space-y-6">
                                    {/* Step 1 */}
                                    <div className="flex gap-4 items-start">
                                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-lime-400/10 flex items-center justify-center text-lime-400 border border-lime-400/20">
                                            <ImageIcon size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold text-lg">1. Remix the Frame</h4>
                                            <p className="text-white/60 text-sm leading-relaxed">
                                                Start by generating a new image variation of the video's starting frame.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Arrow */}
                                    <div className="flex justify-center -my-2 opacity-30">
                                        <ArrowRight className="rotate-90 text-white" />
                                    </div>

                                    {/* Step 2 */}
                                    <div className="flex gap-4 items-start">
                                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
                                            <Clapperboard size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold text-lg">2. Animate It</h4>
                                            <p className="text-white/60 text-sm leading-relaxed">
                                                Once you love the image, use the <b>Animate</b> button to bring it to life as a video.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-white/5">
                                    <button
                                        type="button"
                                        className="w-full rounded-2xl bg-lime-400 px-4 py-4 text-sm font-bold uppercase tracking-wider text-black shadow-[0_0_20px_-5px_#B7FF00] hover:bg-lime-300 hover:shadow-[0_0_30px_-5px_#B7FF00] transition-all transform hover:scale-[1.02]"
                                        onClick={onStart}
                                    >
                                        Start Remix
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
