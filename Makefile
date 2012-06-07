DEPS:=$(shell find http-pub/ -type f -name "*.*")
PATH:=./node_modules/.bin/:${PATH}

http-pub-production: http-pub/index.html $(DEPS)
	buildProduction \
		--root http-pub \
		--outroot $@ \
		$<

PHONY: clean

clean:
	rm -rf http-pub-production
