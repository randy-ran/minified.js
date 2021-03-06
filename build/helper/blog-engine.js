/**
 * Simple Minified-based blog template tool.
 * 
 * Takes a list of blog entries as input, and generates
 *  - one page per blog entry
 *  - index pages containing the last entries
 *  - one archive page per year
 *  - an atom feed
 */

var fs = require('fs');
var hanson = require('hanson');
var _ = require('minified-headless');
var markdown = require( "markdown" ).markdown;

var minitemplate = require('./minitemplate.js');

var defaultOptions = {
		entriesOnIndexPage: 15,
		maxIndexPages: 10,
		entriesOnRss: 20,
		blogTitle: 'Minified.js Blog',
		pageTitleTemplate: '{{title}} - Minified.js Blog',
		commentIdTemplate: 'blog-{{id}}',
		commentRef: '#comments',
		urlBase: 'http://localhost:8080/blog/',
		entryFileNameTemplate: '{{timestamp::yyyy}}/{{timestamp::MM}}/{{id}}.html',
		indexFileNameTemplate: '/index{{if index > 0}}-{{index}}{{/if}}.html',
		archiveFileNameTemplate: '{{year}}/index.html',
		rssFileName: 'rss20.xml',
		pageTemplateDefaults: {section: 'blog', externalCss: ['/css/blog.css'], rssFeed: 'http://localhost:8080/blog/rss20.xml'},
		timestampFormat: 'yyyy-MM-dd HH:mm',
		entryHtmlTemplate: '<div>'+
			'{{if instr.nav}}<div class="nav">{{if entry.prevEntry}}<a href="{{entry.prevEntry.url}}">{{entry.prevEntry.title}}</a> | {{/if}}'+
			'<a href="{{opts.urlBase}}">Main</a>'+
			'{{if entry.nextEntry}} | <a href="{{entry.nextEntry.url}}">{{entry.nextEntry.title}}</a>{{/if}}</div>{{/if}}\n'+
			'<h2>{{entry.title}}</h2>\n'+
			'<div class="entry">{{{entry.html}}}</div>\n'+
			'<div class="entryFooter">'+
			'<div>Posted by {{entry.author}} on {{entry.timestamp::N d, yyyy}} - <a href="{{entry.url}}">Permalink</a> - '+
			'<a href="{{entry.url}}{{opts.commentRef}}">Comments</a></div>'+
		    '</div>'+
		    '{{if instr.rss}}<div class="rss"><a href="{{opts.urlBase}}{{opts.rssFileName}}">subscribe to this blog&apos;s feed</a></div>{{/if}}'+
		    '</div>\n',
			indexHtmlTemplate: '<div>'+
			'{{each entries}}{{{opts.entryHtmlTemplate({entry: this, opts: opts, instr: {} })}}}{{/each}}\n'+
			'<div class="nav">{{if index}}<a href="{{opts.indexFileNameTemplate({index:index-1})}}">previous</a> | '+
			'<a href="{{opts.indexFileNameTemplate({index:0})}}">Main</a> | {{/if}}'+
			'{{if index+1 < pageNum}}<a href="{{opts.indexFileNameTemplate({index:index+1})}}">next</a>{{/if}}'+
		    '</div>'+
		    '<div class="rss"><a href="{{opts.urlBase}}{{opts.rssFileName}}">subscribe to this blog&apos;s feed</a></div>'+
		    '<div class="archive">Archive: {{each aYear, aIndex: _.keys(yearEntries).sort()}}'+
		          '{{if aIndex}} - {{/if}}<a href="{{opts.archiveFileNameTemplate({year:aYear})}}">{{aYear}}</a>'+
		    '{{/each}}</div>'+
		    '</div>\n',
			archiveHtmlTemplate: '<div>\n'+
			'<h2>Archive: {{year}}</h2>\n'+
			'{{each entries}}{{{opts.entryHtmlTemplate({entry: this, opts: opts, instr: {} })}}}{{/each}}\n'+
			'<div class="nav"><a href="{{opts.urlBase}}">Main</a></div>'+
		    '<div class="archive">Archive: {{each aYear, aIndex: _.keys(yearEntries).sort()}}'+
	          '{{if aIndex}} - {{/if}}<a href="{{opts.archiveFileNameTemplate({year:aYear})}}">{{aYear}}</a>'+
	        '{{/each}}</div>'+
			'</div>',
			rssXmlTemplate: '<rss version="2.0"><channel>\n'+
			'<title>{{opts.blogTitle}}</title>\n'+
			'<link>{{opts.urlBase}}</link>\n'+
			'<language>en-us</language>\n'+
			'<pubDate>{{entries[0].timestamp :: [+0000]w, dd n yyyy HH:mm:ss}} GMT</pubDate>\n'+
			'<lastBuildDate>{{new Date() :: [+0000]w, dd n yyyy HH:mm:ss}} GMT</lastBuildDate>\n'+
			'<docs>http://blogs.law.harvard.edu/tech/rss</docs>\n'+
			'<generator>Minified Homebrewn Feed</generator>\n'+
			'<managingEditor>tim@tjansen.de</managingEditor>\n'+
			'<webMaster>tim@tjansen.de</webMaster>\n'+
			'{{each entries}}  <item><title>{{this.title}}</title><link>{{this.url}}</link><description>{{this.desc}}</description>'+
			  '<pubDate>{{this.timestamp :: [+0000]w, dd n yyyy HH:mm:ss}} GMT</pubDate></item>{{/each}}\n\n'+
			'</channel></rss>\n'
};

function createPath() {
	return _(arguments).join('/').replace(/\/\/+/g, '/');
}

/* Entry example:
 * {
	id: 'my-first-entry'
	title: 'First Blog Entry',
	timestamp: '2014-04-01 15:00',
	author: 'Tim Jansen',
	html: `This is <b>my first</b> entry.`,
	markdown: `Markdown data (instead of HTML).`
 * }
 */
function parseEntry(file, prevEntry, opts) {
	if (!file)
		return null;
	var entry = hanson.parse(_.toString(fs.readFileSync(file)));
	entry.timestamp = _.parseDate(opts.timestampFormat, entry.timestamp);
	entry.fileName = opts.entryFileNameTemplate(entry);
	entry.url = opts.urlBase + entry.fileName;
	entry.prevEntry = prevEntry;
	if (entry.markdown)
		entry.html = markdown.toHTML(entry.markdown);
	else
		entry.html = '<p>'+entry.html+'</p>';
	if (prevEntry)
		prevEntry.nextEntry = entry;

	return entry;
}


function createEntryPage(entry, htmlTemplatePath, fileWriter, opts) {
	var obj = _.extend({
		title: opts.pageTitleTemplate(entry),
		commentId: opts.commentIdTemplate(entry),
		main: opts.entryHtmlTemplate({entry: entry, opts: opts, instr: {nav: 1, rss: 1}})
	}, opts.pageTemplateDefaults);
	
	fileWriter(entry.fileName, minitemplate.process(htmlTemplatePath, obj));
}

function createIndexPage(index, pageNum, entryList, yearEntries, htmlTemplatePath, fileWriter, opts) {
	var obj = _.extend({
		title: opts.blogTitle,
		main: opts.indexHtmlTemplate({entries: entryList, yearEntries: yearEntries, index: index, pageNum: pageNum, opts: opts})
	}, opts.pageTemplateDefaults);
	
	fileWriter(opts.indexFileNameTemplate({index: index}), minitemplate.process(htmlTemplatePath, obj));
}

function createArchivePage(year, entryList, yearEntries, htmlTemplatePath, fileWriter, opts) {
	var obj = _.extend({
		title: opts.pageTitleTemplate({title: year}),
		main: opts.archiveHtmlTemplate({entries: entryList, year: year, yearEntries: yearEntries, opts: opts})
	}, opts.pageTemplateDefaults);
	
	fileWriter(opts.archiveFileNameTemplate({year: year}), minitemplate.process(htmlTemplatePath, obj));
}

function createRssPage(entryList, htmlTemplatePath, fileWriter, opts) {

	fileWriter(opts.rssFileName, opts.rssXmlTemplate({ entries: entryList, opts: opts}));
}

exports.process = function(entryFiles, htmlTemplatePath, fileWriter, options) {
	var opts = _.extend({}, defaultOptions, options);
	_.eachObj(opts, function(key, val) {
		if (/Template$/.test(key) && !_.isFunction(val))
			opts[key] = _.template(val, /(Ht|X)mlTemplate$/.test(key) ? _.escapeHtml : null);
	});

	var entryFilesSorted = _.reverse(entryFiles.sort());
	
	var nextEntry = parseEntry(entryFilesSorted[0], null, opts);
	var prevEntry = null;
	
	var entries = _.map(entryFilesSorted, function(entryFile, index) {
		var entry = nextEntry;
		nextEntry = parseEntry(entryFilesSorted[index+1], prevEntry, opts);
		prevEntry = entry;

		createEntryPage(entry, htmlTemplatePath, fileWriter, opts);
		return entry;
	});

	var yearEntries = {}; // year -> []
	var currentRssEntries = [];
	entries.each(function(entry, index) {
		var currentYear = entry.timestamp.getFullYear();
		if (!yearEntries[currentYear])
			yearEntries[currentYear] = [entry];
		else
			yearEntries[currentYear].push(entry);
		
		if (index < opts.entriesOnRss)
			currentRssEntries.push(entry);
	});
	
	_.eachObj(yearEntries, function(year, entryList) {
		createArchivePage(year, entryList, yearEntries, htmlTemplatePath, fileWriter, opts);
	});
	
	var pageCount = Math.min(Math.ceil(entries.length / opts.entriesOnIndexPage), opts.maxIndexPages);
	for (var page = 0; page < pageCount; page++)
		createIndexPage(page, pageCount, entries.sub(page*opts.entriesOnIndexPage, (page+1)*opts.entriesOnIndexPage), yearEntries, htmlTemplatePath, fileWriter, opts);
	
	createRssPage(currentRssEntries, htmlTemplatePath, fileWriter, opts);
};



