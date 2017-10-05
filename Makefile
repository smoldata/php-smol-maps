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
	unzip -q refill-style.zip -d www/styles
	rm refill-style.zip
	rm -rf www/styles/refill
	mv www/styles/refill-style-$(REFILL_VERSION) www/styles/refill

style_walkabout:
	curl -o walkabout-style.zip -Ls https://github.com/tangrams/walkabout-style/archive/v$(WALKABOUT_VERSION).zip
	unzip -q walkabout-style.zip -d www/styles
	rm walkabout-style.zip
	rm -rf www/styles/walkabout
	mv www/styles/walkabout-style-$(WALKABOUT_VERSION) www/styles/walkabout

style_bubble_wrap:
	curl -o bubble-wrap.zip -Ls https://github.com/tangrams/bubble-wrap/archive/v$(BUBBLE_WRAP_VERSION).zip
	unzip -q bubble-wrap.zip -d www/styles
	rm bubble-wrap.zip
	rm -rf www/styles/bubble-wrap
	mv www/styles/bubble-wrap-$(BUBBLE_WRAP_VERSION) www/styles/bubble-wrap

tiles:
	./tilepack.sh ${CURDIR}/www/tiles
