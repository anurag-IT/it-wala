jQuery(document).ready(function($) {

    gsap.registerPlugin(ScrollTrigger, ScrollSmoother, ScrollToPlugin);
	if($('#smooth-wrapper').length && $('#smooth-content').length){
		ScrollSmoother.create({
			smooth: 0.9,
			effects: true,
			smoothTouch: .1,
			ignoreMobileResize: false
		})
	}


    /*---------- 27.Fade-class-active ----------*/
    const initFadeAnimations = () => {
        if ($(".th_fade_anim").length > 0) {
            gsap.utils.toArray(".th_fade_anim").forEach((item) => {
                let th_fade_anim = $(item).data("fade-offset") || 40,
                    th_duration_value = $(item).data("duration") || 0.75,
                    th_fade_direction = $(item).data("fade-from") || "bottom",
                    th_onscroll_value = $(item).data("on-scroll") || 1,
                    th_delay_value = $(item).data("delay") || 0.15,
                    th_ease_value = $(item).data("ease") || "power2.out";

                let th_anim_setting = {
                    opacity: 0,
                    ease: th_ease_value,
                    duration: th_duration_value,
                    delay: th_delay_value,
                    x: (th_fade_direction == "left" ? -th_fade_anim : (th_fade_direction == "right" ? th_fade_anim : 0)),
                    y: (th_fade_direction == "top" ? -th_fade_anim : (th_fade_direction == "bottom" ? th_fade_anim : 0)),
                };

                if (th_onscroll_value == 1) {
                    th_anim_setting.scrollTrigger = {
                        trigger: item,
                        start: 'top 85%',
                        // markers: true, // Uncomment this to debug visually
                    };
                }
                gsap.from(item, th_anim_setting);
            });
        }
    };

    $(window).on('load', function() {
        initFadeAnimations();
        // Force a recalculation once everything (images/fonts) is loaded
        setTimeout(() => {
            ScrollTrigger.refresh();
        }, 100);
    });
    
    gsap.utils.toArray(".th-text-perspective").forEach(splitTextLine => {
     const delay_value = parseFloat(splitTextLine.getAttribute("data-delay") || 0.5);
     const tl = gsap.timeline({
         scrollTrigger: {
             trigger: splitTextLine,
             start: 'top 85%',
             duration: 1.5,
             scrub: false,
             markers: false,
             toggleActions: 'play none none none'
         }
     });
     const itemSplitted = new SplitText(splitTextLine, { type: "lines" });
     gsap.set(splitTextLine, { perspective: 400 });
     itemSplitted.split({ type: "lines" });

     tl.from(itemSplitted.lines, {
         duration: 1,
         delay: delay_value,
         opacity: 0,
         rotationX: -80,
         force3D: true,
         transformOrigin: "top center -50",
         stagger: 0.1
     });
    });


    /*---------- 28.1 webgl images hover animation ----------*/
    if ($('.th--hover-item').length) {
     let hoverAnimation__do = function (t, n) {
         let a = new hoverEffect({
             parent: t.get(0),
             intensity: t.data("intensity") || void 0,
             speedIn: t.data("speedin") || void 0,
             speedOut: t.data("speedout") || void 0,
             easing: t.data("easing") || void 0,
             hover: t.data("hover") || void 0,
             image1: n.eq(0).attr("src"),
             image2: n.eq(0).attr("src"),
             displacementImage: t.data("displacement"),
             imagesRatio: n[0].height / n[0].width,
             hover: !1
         });
         t.closest(".th--hover-item").on("mouseenter", function () {
             a.next()
         }).on("mouseleave", function () {
             a.previous()
         })
     }
     let hoverAnimation = function () {
         $(".th--hover-img").each(function () {
             let n = $(this);
             let e = n.find("img");
             let i = e.eq(0);
             i[0].complete ? hoverAnimation__do(n, e) : i.on("load", function () {
                 hoverAnimation__do(n, e)
             })
         })
     }
     hoverAnimation();
    }
    


});








