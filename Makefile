REFILL_VERSION = 9.0.0
WALKABOUT_VERSION = 6.0.0
BUBBLE_WRAP_VERSION = 8.0.0

all: deps styles tiles

deps:
	npm update
	bower update

styles: style_refill style_walkabout style_bubble_wrap

style_refill:
	curl -o refill-style.zip -Ls https://github.com/tangrams/refill-style/archive/v$(REFILL_VERSION).zip
	unzip -q refill-style.zip -d www/lib
	rm refill-style.zip
	rm -rf www/lib/refill-style
	mv www/lib/refill-style-$(REFILL_VERSION) www/lib/refill-style

style_walkabout:
	curl -o walkabout-style.zip -Ls https://github.com/tangrams/walkabout-style/archive/v$(WALKABOUT_VERSION).zip
	unzip -q walkabout-style.zip -d www/lib
	rm walkabout-style.zip
	rm -rf www/lib/walkabout-style
	mv www/lib/walkabout-style-$(WALKABOUT_VERSION) www/lib/walkabout-style

style_bubble_wrap:
	curl -o bubble-wrap.zip -Ls https://github.com/tangrams/bubble-wrap/archive/v$(BUBBLE_WRAP_VERSION).zip
	unzip -q bubble-wrap.zip -d www/lib
	rm bubble-wrap.zip
	rm -rf www/lib/bubble-wrap-style
	mv www/lib/bubble-wrap-$(BUBBLE_WRAP_VERSION) www/lib/bubble-wrap-style

tiles:
	./tilepack.sh ${CURDIR}/www/tiles
